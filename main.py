import streamlit as st
import tensorflow as tf
from tensorflow import keras
from keras.layers import InputLayer
import numpy as np
import gdown
import os

# ---------------------------
# Google Drive Model Setup
# ---------------------------
MODEL_ID = "1--eKLPThHw64S5IB4Csv5dTWZ35uxicZ"  # File ID from your Drive link
MODEL_URL = f"https://drive.google.com/uc?id={MODEL_ID}"
MODEL_PATH = "cnn_model.keras"

# Custom InputLayer fix for Keras config compatibility
def inputlayer_from_config(config):
    if "batch_shape" in config:
        config["shape"] = config.pop("batch_shape")[1:]  # remove batch dim
    return InputLayer.from_config(config)

keras.utils.get_custom_objects()["InputLayer"] = inputlayer_from_config

# Load model with caching (download once)
@st.cache_resource
def load_model():
    if not os.path.exists(MODEL_PATH):
        with st.spinner("Downloading model..."):
            gdown.download(MODEL_URL, MODEL_PATH, quiet=False)
    return tf.keras.models.load_model(MODEL_PATH)

model = load_model()

# ---------------------------
# Prediction Function
# ---------------------------
def model_prediction(test_image):
    image = tf.keras.preprocessing.image.load_img(test_image, target_size=(224, 224))
    input_arr = tf.keras.preprocessing.image.img_to_array(image)
    input_arr = np.array([input_arr]) / 255.0  # normalize
    predictions = model.predict(input_arr)
    return np.argmax(predictions)

# Class names (38 classes)
CLASS_NAMES = [
    "Apple___Apple_scab",
    "Apple___Black_rot",
    "Apple___Cedar_apple_rust",
    "Apple___healthy",
    "Blueberry___healthy",
    "Cherry_(including_sour)___Powdery_mildew",
    "Cherry_(including_sour)___healthy",
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
    "Corn_(maize)___Common_rust_",
    "Corn_(maize)___Northern_Leaf_Blight",
    "Corn_(maize)___healthy",
    "Grape___Black_rot",
    "Grape___Esca_(Black_Measles)",
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
    "Grape___healthy",
    "Orange___Haunglongbing_(Citrus_greening)",
    "Peach___Bacterial_spot",
    "Peach___healthy",
    "Pepper,_bell___Bacterial_spot",
    "Pepper,_bell___healthy",
    "Potato___Early_blight",
    "Potato___Late_blight",
    "Potato___healthy",
    "Raspberry___healthy",
    "Soybean___healthy",
    "Squash___Powdery_mildew",
    "Strawberry___Leaf_scorch",
    "Strawberry___healthy",
    "Tomato___Bacterial_spot",
    "Tomato___Early_blight",
    "Tomato___Late_blight",
    "Tomato___Leaf_Mold",
    "Tomato___Septoria_leaf_spot",
    "Tomato___Spider_mites Two-spotted_spider_mite",
    "Tomato___Target_Spot",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
    "Tomato___Tomato_mosaic_virus",
    "Tomato___healthy"
]

# ---------------------------
# Streamlit Pages
# ---------------------------
st.sidebar.title("Dashboard")
app_mode = st.sidebar.selectbox("Select Page", ["Home", "About", "Disease Recognition"])

# Home Page
if app_mode == "Home":
    st.header("🌱 Plant Disease Recognition System")
    image_path = "home_page.jpeg"
    if os.path.exists(image_path):
        st.image(image_path, use_container_width=True)
    st.markdown("""
    Welcome to the Plant Disease Recognition System! 🌿🔍
    
    Our mission is to help in identifying plant diseases efficiently. Upload an image of a plant, and our system will analyze it to detect any signs of diseases. Together, let's protect our crops and ensure a healthier harvest!

    ### How It Works
    1. **Upload Image:** Go to the **Disease Recognition** page and upload an image of a plant with suspected diseases.
    2. **Analysis:** Our system will process the image using deep learning to identify potential diseases.
    3. **Results:** View the results and recommendations for further action.

    ### Why Choose Us?
    - **Accuracy:** State-of-the-art deep learning techniques for disease detection.
    - **User-Friendly:** Simple and intuitive interface.
    - **Fast and Efficient:** Results in seconds for quick decision-making.
    """)

# About Page
elif app_mode == "About":
    st.header("About")
    st.markdown("""
    #### About Dataset
    This dataset is recreated using offline augmentation from the original dataset.  
    It consists of about **87K RGB images** of healthy and diseased crop leaves categorized into **38 different classes**.  

    - **Train:** 70,295 images  
    - **Validation:** 17,572 images  
    - **Test:** 33 images  

    Source: Public plant disease dataset (PlantVillage).  
    """)

# Disease Recognition Page
elif app_mode == "Disease Recognition":
    st.header("Disease Recognition")
    test_image = st.file_uploader("Choose a Plant Leaf Image:", type=["jpg", "png", "jpeg"])
    
    if test_image is not None:
        st.image(test_image, use_container_width=True, caption="Uploaded Image")

    if st.button("Predict") and test_image is not None:
        st.snow()
        st.write("Analyzing image...")
        result_index = model_prediction(test_image)
        st.success(f"🌿 Prediction: **{CLASS_NAMES[result_index]}**")

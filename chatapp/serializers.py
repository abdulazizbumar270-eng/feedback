from rest_framework import serializers
from .models import *
from django.contrib.auth.models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('username', 'password')

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password']
        )
        return user

class UserListSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'is_staff', 'is_superuser')


class CurrentUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'is_staff', 'is_superuser')


class ConversationSerializer(serializers.ModelSerializer):
    participants = UserListSerializer(many=True, read_only=True)
    class Meta:
        model = Conversation
        fields = ('id', 'participants', 'created_at')

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        return representation

class MessageSerializer(serializers.ModelSerializer):
    sender = UserListSerializer()
    participants = serializers.SerializerMethodField()
    class Meta:
        model = Message
        fields = ('id', 'conversation', 'sender', 'content', 'timestamp', 'participants')

    def get_participants(self, obj):
        return UserListSerializer(obj.conversation.participants.all(), many=True).data


class CreateMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ('conversation', 'content')


class FeedbackSerializer(serializers.ModelSerializer):
    user = UserListSerializer(read_only=True)

    class Meta:
        model = __import__('chatapp.models', fromlist=['Feedback']).Feedback
        fields = ('id', 'user', 'name', 'email', 'subject', 'message', 'type', 'status', 'admin_response', 'created_at', 'updated_at')
        # Allow admin to update `status` and `admin_response` via the update endpoint.
        # View logic enforces that non-staff users cannot change these fields.
        read_only_fields = ('created_at', 'updated_at')


class CreateFeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = __import__('chatapp.models', fromlist=['Feedback']).Feedback
        fields = ('name', 'email', 'subject', 'message', 'type')
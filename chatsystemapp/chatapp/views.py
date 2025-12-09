from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from .models import *
from .serializers import *
from rest_framework.exceptions import PermissionDenied
from django.core.mail import send_mail
from django.conf import settings
from rest_framework.views import APIView
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        serializer = CurrentUserSerializer(request.user)
        return Response(serializer.data)


class CreateUserView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer


class UserListView(generics.ListAPIView):
    queryset = User.objects.all()
    serializer_class = UserListSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Admins see all users; regular users only see themselves and admins
        from django.db.models import Q
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return User.objects.all()
        return User.objects.filter(Q(id=user.id) | Q(is_staff=True)).distinct()

class ConversationListCreateView(generics.ListCreateAPIView):

    serializer_class = ConversationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (Conversation.objects
                .filter(participants=self.request.user)
                .prefetch_related('participants'))

    def create(self, request, *args, **kwargs):
        participants_data = request.data.get('participants', [])

        if len(participants_data) != 2:
            return Response(
                {'error': 'A conversation needs exactly two participants'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if str(request.user.id) not in map(str, participants_data):
            return Response(
                {'error': 'You are not a participant of this conversation'},
                status=status.HTTP_403_FORBIDDEN
            )
        users = User.objects.filter(id__in=participants_data)
        if users.count() != 2:
            return Response(
                {'error': 'A conversation needs exactly two participants'},
                status=status.HTTP_400_BAD_REQUEST
            )

        existing_conversation = Conversation.objects.filter(
            participants__id=participants_data[0]
        ).filter(
            participants__id=participants_data[1]
        ).distinct()

        if existing_conversation.exists():
            return Response(
                {'error': 'A conversation already exists between these participants'},
                status=status.HTTP_400_BAD_REQUEST
            )
        # Enforce that regular users can only start conversations with admins
        other_user = users.exclude(id=request.user.id).first()
        if other_user is None:
            return Response({'error': 'Invalid participants'}, status=status.HTTP_400_BAD_REQUEST)

        if not (request.user.is_staff or request.user.is_superuser):
            # current user is a normal user; the other participant must be staff
            if not other_user.is_staff and not other_user.is_superuser:
                return Response({'error': 'You can only start conversations with an admin'}, status=status.HTTP_403_FORBIDDEN)

        conversation = Conversation.objects.create()
        conversation.participants.set(users)

        #serialize the conversation
        serializer = self.get_serializer(conversation)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class MessageListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        conversation_id = self.kwargs['conversation_id']
        conversation = self.get_conversation(conversation_id)

        return conversation.messages.order_by('timestamp')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateMessageSerializer
        return MessageSerializer

    def perform_create(self, serializer):
        #fetch conversation and validate user participation
        print("Incoming conversation", self.request.data)
        conversation_id = self.kwargs['conversation_id']
        conversation = self.get_conversation(conversation_id)

        serializer.save(sender=self.request.user, conversation=conversation)

    def get_conversation(self, conversation_id):
        #check if user is a participant of the conversation, it helps to fetch the conversation and 
        #validate the participants
        conversation = get_object_or_404(Conversation, id=conversation_id)
        if self.request.user not in conversation.participants.all():
            raise PermissionDenied('You are not a participant of this conversation')
        return conversation

class MessageRetrieveDestroyView(generics.RetrieveDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MessageSerializer

    def get_queryset(self):
        conversation_id = self.kwargs['conversation_id']
        return Message.objects.filter(conversation__id=conversation_id)

    def perform_destroy(self, instance):
        if instance.sender != self.request.user:
            raise PermissionDenied('You are not the sender of this message')
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ConversationRetrieveDestroyView(generics.RetrieveDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ConversationSerializer

    def get_queryset(self):
        return Conversation.objects.all()

    def get_object(self):
        # For retrieval ensure the requester is a participant; for delete we'll check admin rights
        obj = get_object_or_404(Conversation, id=self.kwargs.get('pk'))
        if self.request.method == 'GET':
            if self.request.user not in obj.participants.all():
                raise PermissionDenied('You are not a participant of this conversation')
        return obj

    def perform_destroy(self, instance):
        # Only staff/superuser can delete a conversation
        if not (self.request.user.is_staff or self.request.user.is_superuser):
            raise PermissionDenied('Only admins can delete conversations')
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class FeedbackListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_staff or self.request.user.is_superuser:
            return Feedback.objects.all().order_by('-created_at')
        return Feedback.objects.filter(user=self.request.user).order_by('-created_at')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateFeedbackSerializer
        return FeedbackSerializer

    def perform_create(self, serializer):
        feedback = serializer.save(user=self.request.user)

        # notify admins by email (development: console backend will print)
        admin_emails = list(User.objects.filter(is_superuser=True, email__isnull=False).values_list('email', flat=True))
        if admin_emails:
            subject = f"New {feedback.get_type_display()} submitted: {feedback.subject}"
            message = f"A new {feedback.get_type_display()} has been submitted by {self.request.user.username or feedback.name}\n\nSubject: {feedback.subject}\n\nMessage:\n{feedback.message}\n\nView in admin to respond and change status."
            from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or None
            try:
                send_mail(subject, message, from_email, admin_emails, fail_silently=True)
            except Exception:
                pass


class FeedbackRetrieveUpdateView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FeedbackSerializer

    def get_queryset(self):
        if self.request.user.is_staff or self.request.user.is_superuser:
            return Feedback.objects.all()
        return Feedback.objects.filter(user=self.request.user)

    def get_serializer_class(self):
        """Use UpdateFeedbackSerializer for PATCH to allow partial updates."""
        if self.request.method == 'PATCH':
            return UpdateFeedbackSerializer
        return FeedbackSerializer

    def perform_update(self, serializer):
        feedback = self.get_object()

        # if a staff updates, allow changing status and admin_response
        if self.request.user.is_staff or self.request.user.is_superuser:
            updated = serializer.save()
            # if admin_response provided, notify the user by email
            if updated.admin_response and updated.user and updated.user.email:
                subject = f"Response to your feedback: {updated.subject}"
                message = f"An admin has responded to your feedback:\n\n{updated.admin_response}\n\nStatus: {updated.get_status_display()}"
                from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or None
                try:
                    send_mail(subject, message, from_email, [updated.user.email], fail_silently=True)
                except Exception:
                    pass
            # send realtime notification to the user's notification group (if channels running)
            try:
                channel_layer = get_channel_layer()
                payload = {
                    'type': 'feedback_update',
                    'feedback': {
                        'id': updated.id,
                        'admin_response': updated.admin_response,
                        'status': updated.status,
                        'subject': updated.subject,
                        'message': updated.message,
                        'updated_at': updated.updated_at.isoformat() if updated.updated_at else None,
                    }
                }
                async_to_sync(channel_layer.group_send)(f'user_{updated.user.id}', payload)
            except Exception:
                # ignore if channel layer not configured or send fails
                pass
            return

        # if normal user updates, prevent changing status/admin_response
        data = dict(self.request.data)
        if 'status' in data or 'admin_response' in data:
            raise PermissionDenied('You cannot modify status or admin response')
        serializer.save()

    def update(self, request, *args, **kwargs):
        """Override update to log validation errors and request payload for easier debugging.
        Returns serializer errors with 400 if validation fails, and prints details to server logs.
        """
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if not serializer.is_valid():
            # Log details for debugging
            try:
                print("Feedback update validation failed. data=", request.data)
                print("Validation errors:", serializer.errors)
            except Exception:
                pass
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        return super().update(request, *args, **kwargs)

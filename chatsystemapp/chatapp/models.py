from django.db import models
from django.contrib.auth.models import User
from django.db.models import Prefetch



class ConversationManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().prefetch_related(
            Prefetch('participants', queryset=User.objects.only('id', 'username'))
        )


class Conversation(models.Model):
    participants = models.ManyToManyField(User, related_name='conversations')
    created_at = models.DateTimeField(auto_now_add=True)
    objects = ConversationManager()


    def __str__(self):
        participant_names = " ,".join([user.username for user in self.participants.all()])
        return f'Conversation with {participant_names}'


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE)
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)


    def __str__(self):
        return f'Message from {self.sender.username} in {self.content[:20]}'


class Feedback(models.Model):
    FEEDBACK = 'feedback'
    COMPLAINT = 'complaint'
    QUESTION = 'question'
    TYPE_CHOICES = [
        (FEEDBACK, 'Feedback'),
        (COMPLAINT, 'Complaint'),
        (QUESTION, 'Question'),
    ]

    OPEN = 'open'
    IN_PROGRESS = 'in_progress'
    RESOLVED = 'resolved'
    STATUS_CHOICES = [
        (OPEN, 'Open'),
        (IN_PROGRESS, 'In Progress'),
        (RESOLVED, 'Resolved'),
    ]

    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='feedbacks')
    name = models.CharField(max_length=150, blank=True)
    email = models.EmailField(blank=True)
    subject = models.CharField(max_length=255)
    message = models.TextField()
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=FEEDBACK)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=OPEN)
    admin_response = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.subject} ({self.get_type_display()}) - {self.get_status_display()}"
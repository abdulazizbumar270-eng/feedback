from django.contrib import admin
from .models import *

admin.site.register(Conversation)
admin.site.register(Message)


@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
	list_display = ('id', 'subject', 'type', 'status', 'user', 'created_at')
	search_fields = ('subject', 'message', 'name', 'email')
	list_filter = ('type', 'status', 'created_at')
	readonly_fields = ('created_at', 'updated_at')

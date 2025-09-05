import uuid
from django.db import models


class DomainTaskStatusChoices(models.TextChoices):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    ERROR = "error"
    
class TypeChoices(models.TextChoices):
    CREATE_VENV = "create_venv"
    INSTALL_LIBRARIES = "install_libraries"
    GET_LIBRARIES = "get_libraries"
    GET_VENV_EXISTS = "get_venv_exists"
    REMOVE_VENV = "remove_venv"
    EXECUTE_CODE = "execute_code"

class DomainTask(models.Model):

    id = models.UUIDField(primary_key=True, editable=False)
    payload = models.JSONField(null=True, blank=True)
    type = models.CharField(max_length=50, choices=TypeChoices)
    status = models.CharField(max_length=20, choices=DomainTaskStatusChoices, default=DomainTaskStatusChoices.PENDING)
    message = models.TextField(null=True, blank=True)
    data = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.type} — {self.id} ({self.status})"

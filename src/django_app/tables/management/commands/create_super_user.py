import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

username = os.environ.get("SUPERUSER_NAME", "superuser_name")
password = os.environ.get("SUPERUSER_PASSWORD", "superuser_password")


class Command(BaseCommand):
    def handle(self, *args, **kwargs):
        User = get_user_model()
        if not User.objects.filter(username=username).exists():
            User.objects.create_superuser(username=username, password=password)
            self.stdout.write("Superuser created.")
        else:
            self.stdout.write("Superuser already exists.")

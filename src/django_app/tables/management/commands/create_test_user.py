from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    def handle(self, *args, **kwargs):
        User = get_user_model()
        if not User.objects.filter(username="testuser_1").exists():
            User.objects.create_user(
                username="testuser_1", password="testuser_password"
            )
            self.stdout.write("Test user created.")
        else:
            self.stdout.write("Test user already exists.")

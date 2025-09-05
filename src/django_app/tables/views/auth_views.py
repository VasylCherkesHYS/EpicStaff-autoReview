from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.models import User
from django.utils import timezone
import time
from django.core.cache import cache
from rest_framework.throttling import AnonRateThrottle
from loguru import logger


class LoginRateThrottle(AnonRateThrottle):

    rate = "5/min"


class LoginAPIView(APIView):

    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request):

        username = request.data.get("username")
        password = request.data.get("password")

        if not username or not password:
            return Response(
                {"error": "Both username and password are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cache_key = f"login_attempts_{username}"
        failed_attempts = cache.get(cache_key, 0)

        if failed_attempts >= 10:
            return Response(
                {"error": "Too many failed login attempts. Please try again later."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        user = authenticate(username=username, password=password)

        if user is not None:
            if not user.is_active:
                return Response(
                    {"error": "Account is disabled"}, status=status.HTTP_403_FORBIDDEN
                )

            if failed_attempts > 0:
                cache.delete(cache_key)

            user.last_login = timezone.now()
            user.save(update_fields=["last_login"])

            refresh = RefreshToken.for_user(user)

            return Response(
                {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                    "user_id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "is_staff": user.is_staff,
                }
            )
        else:
            cache.set(cache_key, failed_attempts + 1, 300)
            return Response(
                {"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED
            )

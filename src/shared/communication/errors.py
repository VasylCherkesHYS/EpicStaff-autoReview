class CommunicationError(Exception):
    """Base error for the communication package."""


class StorageError(CommunicationError):
    """Base error for the storage."""


class BrokerError(CommunicationError):
    """Base error for the broker."""

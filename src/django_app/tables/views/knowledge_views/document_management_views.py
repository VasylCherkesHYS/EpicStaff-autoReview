import io
import mimetypes
import zipfile

from django.http import HttpResponse
from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from drf_spectacular.utils import extend_schema, OpenApiResponse, OpenApiParameter
from rest_framework import serializers as drf_serializers

from tables.models import DocumentMetadata
from tables.serializers.knowledge_serializers import (
    DocumentMetadataSerializer,
    DocumentUploadSerializer,
    DocumentBulkDeleteSerializer,
    CopyDocumentsSerializer,
    DocumentListSerializer,
    DocumentDetailSerializer,
)
from tables.services.knowledge_services.document_management_service import (
    DocumentManagementService,
)
from tables.swagger_schemas.knowledge_schemas.document_management_schemas import (
    DOCUMENTS_LIST_GET,
    DOCUMENTS_RETRIEVE_GET,
    DOCUMENTS_DESTROY_DELETE,
    DOCUMENTS_UPLOAD_POST,
    DOCUMENTS_BULK_DELETE_POST,
    DOCUMENTS_DOWNLOAD_GET,
    DOCUMENTS_PREVIEW_GET,
    DOCUMENTS_COPY_POST,
    COLLECTION_DOCUMENTS_LIST_GET,
)
from tables.exceptions import (
    DocumentUploadException,
    FileSizeExceededException,
    InvalidFileTypeException,
    CollectionNotFoundException,
    NoFilesProvidedException,
    DocumentNotFoundException,
    DocumentsNotFoundException,
    InvalidFieldType,
)


def _document_bytes(document: DocumentMetadata) -> bytes:
    """Return the binary payload of a document, or empty bytes if absent."""
    content = document.document_content
    if content is None or content.content is None:
        return b""
    return bytes(content.content)


# Explicit content types per known file_type — more reliable for inline preview
# than guessing from the file name (e.g. .md / .json are not always registered).
PREVIEW_CONTENT_TYPES = {
    DocumentMetadata.DocumentFileType.PDF: "application/pdf",
    DocumentMetadata.DocumentFileType.CSV: "text/csv; charset=utf-8",
    DocumentMetadata.DocumentFileType.DOCX: (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ),
    DocumentMetadata.DocumentFileType.TXT: "text/plain; charset=utf-8",
    DocumentMetadata.DocumentFileType.JSON: "application/json; charset=utf-8",
    DocumentMetadata.DocumentFileType.HTML: "text/html; charset=utf-8",
    DocumentMetadata.DocumentFileType.MD: "text/markdown; charset=utf-8",
}


def _file_response(
    content: bytes,
    content_type: str,
    filename: str,
    disposition: str = "attachment",
) -> HttpResponse:
    """Serve raw bytes with the given content type and Content-Disposition."""
    response = HttpResponse(content, content_type=content_type)
    response["Content-Disposition"] = f'{disposition}; filename="{filename}"'
    return response


def _build_file_response(document: DocumentMetadata) -> HttpResponse:
    """Build an attachment response for a single document."""
    content_type = (
        mimetypes.guess_type(document.file_name)[0] or "application/octet-stream"
    )
    return _file_response(_document_bytes(document), content_type, document.file_name)


def _build_preview_response(document: DocumentMetadata) -> HttpResponse:
    """
    Build an inline response for a single document so the browser can render it
    in place (preview) instead of downloading it. DOCX has no native browser
    preview and will still be downloaded by the browser regardless of this header.
    """
    content_type = (
        PREVIEW_CONTENT_TYPES.get(document.file_type)
        or mimetypes.guess_type(document.file_name)[0]
        or "application/octet-stream"
    )
    return _file_response(
        _document_bytes(document), content_type, document.file_name, "inline"
    )


def _build_archive_response(
    documents: list, archive_name: str = "documents.zip"
) -> HttpResponse:
    """Bundle multiple documents into a zip attachment, deduplicating file names."""
    buffer = io.BytesIO()
    used_names: dict[str, int] = {}

    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for document in documents:
            archive.writestr(
                _unique_name(document.file_name, used_names),
                _document_bytes(document),
            )

    return _file_response(buffer.getvalue(), "application/zip", archive_name)


def _unique_name(name: str, used_names: dict) -> str:
    """Suffix duplicate file names so no archive entry is overwritten."""
    count = used_names.get(name, 0)
    used_names[name] = count + 1
    if count == 0:
        return name

    stem, dot, ext = name.rpartition(".")
    return f"{stem} ({count}){dot}{ext}" if dot else f"{name} ({count})"


class DocumentManagementViewSet(viewsets.GenericViewSet):
    """
    ViewSet for document upload operations within a collection.

    Endpoints:
    - POST /source-collections/{collection_id}/documents/upload/ - Upload files
    - POST /documents/bulk-delete/ - Delete multiple documents
    """

    def get_serializer_class(self):
        if self.action == "upload_documents":
            return DocumentUploadSerializer
        elif self.action == "bulk_delete":
            return DocumentBulkDeleteSerializer
        return DocumentMetadataSerializer

    @extend_schema(**DOCUMENTS_UPLOAD_POST)
    @action(
        detail=False,
        methods=["post"],
        url_path="source-collections/(?P<collection_id>[^/.]+)/upload",
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_documents(self, request, collection_id=None):
        try:
            collection_id = int(collection_id)
        except (ValueError, TypeError):
            raise InvalidFieldType("collection_id", collection_id)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        files = serializer.validated_data["files"]

        try:
            # Use service to handle all business logic
            created_documents = DocumentManagementService.upload_files_batch(
                collection_id=collection_id, uploaded_files=files
            )

            # Serialize response
            response_serializer = DocumentMetadataSerializer(
                created_documents, many=True
            )

            return Response(
                {
                    "message": f"Successfully uploaded {len(created_documents)} file(s)",
                    "documents": response_serializer.data,
                },
                status=status.HTTP_201_CREATED,
            )

        except CollectionNotFoundException as e:
            return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except NoFilesProvidedException as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except (FileSizeExceededException, InvalidFileTypeException) as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except DocumentUploadException as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {"error": f"An unexpected error occurred: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @extend_schema(**DOCUMENTS_BULK_DELETE_POST)
    @action(
        detail=False,
        methods=["post"],
        url_path="bulk-delete",
    )
    def bulk_delete(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        document_ids = serializer.validated_data["document_ids"]

        try:
            # Use service to handle deletion
            result = DocumentManagementService.delete_documents_batch(document_ids)

            return Response(
                {
                    "message": f"Successfully deleted {result['deleted_count']} document(s)",
                    "deleted_documents": result["documents"],
                },
                status=status.HTTP_200_OK,
            )

        except DocumentNotFoundException as e:
            return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except DocumentUploadException as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {"error": f"An unexpected error occurred: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class DocumentViewSet(
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """
    ViewSet for document CRUD operations.

    Endpoints:
    - GET /documents/ - List all documents
    - GET /documents/{id}/ - Retrieve single document
    - DELETE /documents/{id}/ - Delete single document
    - GET /source-collections/{collection_id}/documents/ - List collection documents
    """

    queryset = DocumentMetadata.objects.select_related("source_collection")

    def get_serializer_class(self):
        if self.action == "list":
            return DocumentListSerializer
        elif self.action == "retrieve":
            return DocumentDetailSerializer
        elif self.action == "copy":
            return CopyDocumentsSerializer
        return DocumentMetadataSerializer

    @extend_schema(**DOCUMENTS_LIST_GET)
    def list(self, request, *args, **kwargs):
        collection_id = request.query_params.get("collection_id")
        queryset = DocumentManagementService.get_documents_list(
            collection_id=collection_id
        )

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @extend_schema(**DOCUMENTS_RETRIEVE_GET)
    def retrieve(self, request, *args, **kwargs):
        """
        Retrieve a single document by ID.
        """
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @extend_schema(**DOCUMENTS_PREVIEW_GET)
    @action(detail=True, methods=["get"], url_path="preview")
    def preview(self, request, *args, **kwargs):
        """
        Return the raw binary content of a single document for inline preview.

        Unlike ``download`` (which forces an attachment), this response uses
        ``Content-Disposition: inline`` so the browser can render supported
        formats (pdf, txt, md, json, html, csv) in place. DOCX has no native
        browser preview and will be downloaded instead.
        """
        document = self.get_object()
        return _build_preview_response(document)

    @extend_schema(**DOCUMENTS_DESTROY_DELETE)
    def destroy(self, request, *args, **kwargs):
        """
        Delete a single document.
        """
        instance = self.get_object()
        document_id = instance.document_id
        file_name = instance.file_name

        try:
            # Use service for deletion
            result = DocumentManagementService.delete_document(document_id)

            return Response(
                {
                    "message": "Document deleted successfully",
                    "document_id": result["document_id"],
                    "file_name": result["file_name"],
                },
                status=status.HTTP_200_OK,
            )

        except DocumentNotFoundException as e:
            return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response(
                {"error": f"An unexpected error occurred: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @extend_schema(**DOCUMENTS_DOWNLOAD_GET)
    @action(detail=False, methods=["get"], url_path="download")
    def download(self, request):
        """
        Download one or multiple documents.
        A single document is returned as-is; multiple are bundled into a zip.
        """
        try:
            document_ids = self._parse_document_ids(
                request.query_params.get("document_ids", "")
            )
        except InvalidFieldType as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        if not document_ids:
            return Response(
                {"error": "document_ids query parameter is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            documents = DocumentManagementService.get_documents_with_content(
                document_ids
            )
        except DocumentsNotFoundException as e:
            return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)

        if len(documents) == 1:
            return _build_file_response(documents[0])
        return _build_archive_response(documents)

    @extend_schema(**DOCUMENTS_COPY_POST)
    @action(detail=False, methods=["post"], url_path="copy")
    def copy(self, request):
        """
        Copy documents into a target collection (shares binary content).
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            copied_documents, skipped_documents = (
                DocumentManagementService.copy_documents_to_collection(
                    collection_id=serializer.validated_data["collection_id"],
                    document_ids=serializer.validated_data["document_ids"],
                )
            )

            message = f"Successfully copied {len(copied_documents)} document(s)"
            if skipped_documents:
                message += (
                    f", skipped {len(skipped_documents)} already present "
                    "in the target collection"
                )

            return Response(
                {
                    "message": message,
                    "documents": DocumentMetadataSerializer(
                        copied_documents, many=True
                    ).data,
                    "skipped": DocumentMetadataSerializer(
                        skipped_documents, many=True
                    ).data,
                },
                status=status.HTTP_201_CREATED,
            )

        except (CollectionNotFoundException, DocumentsNotFoundException) as e:
            return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response(
                {"error": f"An unexpected error occurred: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @staticmethod
    def _parse_document_ids(raw_value: str) -> list:
        """Parse a comma-separated ``document_ids`` query parameter into ints."""
        ids = []
        for chunk in raw_value.split(","):
            chunk = chunk.strip()
            if not chunk:
                continue
            try:
                ids.append(int(chunk))
            except ValueError:
                raise InvalidFieldType("document_ids", chunk)
        return ids


class CollectionDocumentsViewSet(viewsets.GenericViewSet):
    """
    ViewSet for accessing documents within a specific collection.

    Nested route: /source-collections/{collection_id}/documents/
    """

    def get_queryset(self):
        collection_id = self.kwargs.get("collection_id")
        return DocumentMetadata.objects.filter(
            source_collection_id=collection_id
        ).select_related("source_collection")

    def get_serializer_class(self):
        return DocumentListSerializer

    @extend_schema(**COLLECTION_DOCUMENTS_LIST_GET)
    def list(self, request, collection_id=None):
        try:
            collection_id = int(collection_id)
        except (ValueError, TypeError):
            raise InvalidFieldType("collection_id", collection_id)

        # Verify collection exists
        try:
            collection = DocumentManagementService.get_collection(collection_id)
        except CollectionNotFoundException as e:
            return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)

        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)

        return Response(
            {
                "collection_id": collection.collection_id,
                "collection_name": collection.collection_name,
                "document_count": queryset.count(),
                "documents": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

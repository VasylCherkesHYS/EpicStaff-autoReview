from django.db import models


class Venv(models.Model):

    venv_name = models.CharField(max_length=255, unique=True, primary_key=True)
    libraries = models.TextField(default="")

    actual_data = models.JSONField(default=dict)

    def get_libraries_list(self):
        return list(filter(None, self.libraries.split(" ")))

    def set_libraries_list(self, libraries: list[str]):
        self.libraries = " ".join(libraries)


class PythonCode(models.Model):
    code = models.TextField()
    entrypoint = models.TextField(default="main")
    venv = models.ForeignKey(Venv, on_delete=models.SET_NULL, null=True)
    global_kwargs = models.JSONField(default=dict)

    def get_libraries_list(self):
        return self.venv.get_libraries_list()


class PythonCodeTool(models.Model):
    name = models.TextField(unique=True)
    description = models.TextField()
    args_schema = models.JSONField()
    python_code = models.ForeignKey("PythonCode", on_delete=models.CASCADE, null=False)
    favorite = models.BooleanField(default=False)


class PythonCodeResult(models.Model):
    execution_id = models.CharField(max_length=255, primary_key=True)
    result_data = models.TextField(null=True, default=None)
    stderr = models.TextField(default="")
    stdout = models.TextField(default="")
    returncode = models.IntegerField(default=0)

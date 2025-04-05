from setuptools import setup, find_packages

setup(
    name="nag_app",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "fastapi==0.104.1",
        "uvicorn[standard]==0.24.0",
        "python-dotenv==1.0.0",
        "openai==1.3.0",
        "aiofiles==23.2.1",
        "requests==2.31.0",
        "python-multipart==0.0.6",
        "pydantic==1.10.13",
        "email-validator==2.1.0.post1",
        "gunicorn==21.2.0"
    ],
    python_requires=">=3.9",
) 
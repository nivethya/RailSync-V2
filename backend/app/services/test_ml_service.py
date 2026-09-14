from app.services.ml_service import model_status

if __name__ == "__main__":
    status = model_status()
    print(status)

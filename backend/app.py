from flask import Flask, jsonify
from flask_cors import CORS

from routes import api, init_backend
from config import Config


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(
        app,
        resources={r"/api/*": {"origins": ["http://127.0.0.1:5500", "http://localhost:5500", "http://127.0.0.1:5000", "null"]}},
        supports_credentials=True,
    )
    app.register_blueprint(api, url_prefix="/api")
    with app.app_context():
        init_backend()

    @app.get("/")
    def health_check():
        return jsonify({"message": "Siri Sarees Backend Running"})

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True)

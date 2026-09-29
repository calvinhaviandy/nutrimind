from flask import Flask, render_template, request, redirect, session, jsonify, send_from_directory, send_file
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
load_dotenv()
from database import IntegrityError, close_db_connections, get_db
from config import OPENAI_MODEL, USE_POSTGRES
import random
from datetime import date, datetime, timedelta
import os, uuid
import base64
import binascii
from io import BytesIO
from pathlib import Path
from vision import analyze_food_image
from food_data import match_food
from meal_engine import generate_meal_plan
from openai_meal_ai import MealPlanResponseError
from openai import OpenAI, OpenAIError
client = OpenAI() if os.getenv("OPENAI_API_KEY") else None

app = Flask(__name__)
if os.getenv("VERCEL") and not os.getenv("FLASK_SECRET_KEY"):
    raise RuntimeError("FLASK_SECRET_KEY must be configured on Vercel")
app.secret_key = os.getenv("FLASK_SECRET_KEY", "nutrimind-secret-key")
app.teardown_appcontext(close_db_connections)
FRONTEND_DIST = Path(__file__).resolve().parent / "frontend" / "dist"

# Keep the binary image column out of list responses. Each image is fetched
# separately through an authenticated endpoint on PostgreSQL.
FOOD_LOG_PUBLIC_COLUMNS = ", ".join((
    "id", "user_id", "food_name", "image_path", "caloric_value", "fat",
    "saturated_fats", "monounsaturated_fats", "polyunsaturated_fats",
    "carbohydrates", "sugars", "protein", "dietary_fiber", "cholesterol",
    "sodium", "water", "vitamin_a", "vitamin_b1", "vitamin_b11",
    "vitamin_b12", "vitamin_b2", "vitamin_b3", "vitamin_b5", "vitamin_b6",
    "vitamin_c", "vitamin_d", "vitamin_e", "vitamin_k", "calcium",
    "copper", "iron", "magnesium", "manganese", "phosphorus",
    "potassium", "selenium", "zinc", "nutrition_density", "log_date",
    "created_at",
))


def frontend_index():
    """Serve the built SPA when available; keep Jinja as a development fallback."""
    if (FRONTEND_DIST / "index.html").is_file():
        return send_from_directory(FRONTEND_DIST, "index.html")
    return None


def auth_payload(user):
    return {
        "authenticated": True,
        "user": {
            "id": user["id"],
            "name": user["full_name"],
            "email": user["email"],
        },
    }


def save_plan_draft(user_id, plan):
    db = get_db()
    cursor = db.cursor()
    payload = app.json.dumps(plan, ensure_ascii=False)
    if USE_POSTGRES:
        sql = """
            INSERT INTO meal_plan_drafts (user_id, plan_json) VALUES (%s, %s)
            ON CONFLICT (user_id) DO UPDATE SET
              plan_json = EXCLUDED.plan_json, updated_at = CURRENT_TIMESTAMP
        """
    else:
        sql = """
            INSERT INTO meal_plan_drafts (user_id, plan_json) VALUES (%s, %s)
            ON DUPLICATE KEY UPDATE
              plan_json = VALUES(plan_json), updated_at = CURRENT_TIMESTAMP
        """
    cursor.execute(sql, (user_id, payload))
    db.commit()


def load_plan_draft(user_id):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT plan_json FROM meal_plan_drafts WHERE user_id=%s", (user_id,))
    row = cursor.fetchone()
    return app.json.loads(row["plan_json"]) if row else None


@app.route("/assets/<path:filename>")
def frontend_asset(filename):
    return send_from_directory(FRONTEND_DIST / "assets", filename)


@app.route("/images/<path:filename>")
def frontend_image(filename):
    return send_from_directory(FRONTEND_DIST / "images", filename)


@app.route("/app")
@app.route("/app/")
@app.route("/app/<path:subpath>")
def frontend_app(subpath=None):
    spa = frontend_index()
    if spa is not None:
        return spa
    return redirect("/dashboard" if "user_id" in session else "/")


@app.route("/api/session")
def api_session():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"authenticated": False, "user": None})

    db = get_db()
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT id, full_name, email FROM users WHERE id=%s", (user_id,))
        user = cursor.fetchone()
    finally:
        db.close()

    if not user:
        session.clear()
        return jsonify({"authenticated": False, "user": None})

    return jsonify(auth_payload(user))


@app.route("/api/auth/login", methods=["POST"])
def api_auth_login():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email") or "").strip().lower()
    password = data.get("password")
    if not email or not isinstance(password, str) or not password:
        return jsonify({"error": "Email dan password wajib diisi"}), 400

    db = get_db()
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, full_name, email, password_hash FROM users WHERE email=%s",
            (email,),
        )
        user = cursor.fetchone()
    finally:
        db.close()

    password_hash = user["password_hash"] if user else ""
    if isinstance(password_hash, bytes):
        password_hash = password_hash.decode("utf-8")
    if not user or not check_password_hash(password_hash, password):
        return jsonify({"error": "Email atau password salah"}), 401

    session.clear()
    session["user_id"] = user["id"]
    session["user_name"] = user["full_name"]
    return jsonify(auth_payload(user))


@app.route("/api/auth/register", methods=["POST"])
def api_auth_register():
    data = request.get_json(silent=True) or {}
    name = str(data.get("full_name") or "").strip()
    email = str(data.get("email") or "").strip().lower()
    password = data.get("password")
    confirm = data.get("confirm_password")

    if not name or not email or not isinstance(password, str) or not password:
        return jsonify({"error": "Nama, email, dan password wajib diisi"}), 400
    if len(name) > 255 or len(email) > 255 or "@" not in email:
        return jsonify({"error": "Nama atau email tidak valid"}), 400
    if password != confirm:
        return jsonify({"error": "Konfirmasi password tidak cocok"}), 400

    db = get_db()
    try:
        cursor = db.cursor()
        insert_sql = "INSERT INTO users (full_name, email, password_hash) VALUES (%s,%s,%s)"
        if USE_POSTGRES:
            insert_sql += " RETURNING id"
        cursor.execute(insert_sql, (name, email, generate_password_hash(password)))
        user_id = cursor.fetchone()[0] if USE_POSTGRES else cursor.lastrowid
        db.commit()
        user = {"id": user_id, "full_name": name, "email": email}
    except IntegrityError:
        db.rollback()
        return jsonify({"error": "Email sudah terdaftar"}), 409
    finally:
        db.close()

    session.clear()
    session["user_id"] = user["id"]
    session["user_name"] = user["full_name"]
    return jsonify(auth_payload(user)), 201


@app.route("/api/auth/logout", methods=["POST"])
def api_auth_logout():
    session.clear()
    return jsonify({"authenticated": False, "user": None})

# HOME / LANDING
@app.route("/")
def home():
    spa = frontend_index()
    if spa is not None:
        return spa
    if "user_id" in session:
        return redirect("/dashboard")
    return render_template("landing.html")

# LOGIN
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        spa = frontend_index()
        if spa is not None:
            return spa
    if request.method == "POST":
        email = request.form["email"].strip().lower()
        password = request.form["password"]

        db = get_db()
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE email=%s", (email,))
        user = cursor.fetchone()

        if user:
            password_hash = user["password_hash"]

            if isinstance(password_hash, bytes):
                password_hash = password_hash.decode("utf-8")

            if check_password_hash(password_hash, password):
                session["user_id"] = user["id"]
                session["user_name"] = user["full_name"]
                return redirect("/dashboard")

        return render_template("auth/login.html", error="Email atau password salah")

    return render_template("auth/login.html")

# REGISTER
@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "GET":
        spa = frontend_index()
        if spa is not None:
            return spa
    if request.method == "POST":
        name = request.form["full_name"]
        email = request.form["email"]
        password = request.form["password"]
        confirm = request.form["confirm_password"]

        if password != confirm:
            return render_template("auth/register.html", error="Password tidak sama")

        password_hash = generate_password_hash(password)

        db = get_db()
        cursor = db.cursor()
        try:
            cursor.execute(
                "INSERT INTO users (full_name, email, password_hash) VALUES (%s,%s,%s)",
                (name, email, password_hash)
            )
            db.commit()
            return redirect("/login")
        except:
            return render_template("auth/register.html", error="Email sudah terdaftar")

    return render_template("auth/register.html")

# LANDING (direct link if needed)
@app.route("/landing")
def landing():
    spa = frontend_index()
    if spa is not None:
        return spa
    return render_template("landing.html")

# DASHBOARD
@app.route("/dashboard")
def dashboard():
    spa = frontend_index()
    if spa is not None:
        return spa
    if "user_id" not in session:
        return redirect("/")
    return render_template("dashboard.html", user=session["user_name"])

@app.route("/api/dashboard")
def api_dashboard():
    if "user_id" not in session:
        return jsonify({"error": "unauthorized"}), 401

    user_id = session["user_id"]
    date_q = request.args.get("date", date.today().isoformat())
    db = get_db()
    c = db.cursor(dictionary=True)

    # Intake Harian
    c.execute("""
        SELECT
          COALESCE(SUM(caloric_value),0) calories,
          COALESCE(SUM(protein),0) protein,
          COALESCE(SUM(carbohydrates),0) carbs,
          COALESCE(SUM(fat),0) fat
        FROM food_logs
        WHERE user_id=%s AND log_date=%s
    """, (user_id, date_q))
    intake = c.fetchone()

    # Meal Log
    c.execute("""
        SELECT m.meal_type, m.title, m.calories
        FROM meal_plans p
        JOIN meal_plan_meals m ON p.id=m.plan_id
        WHERE p.user_id=%s AND p.plan_date=%s
    """, (user_id, date_q))
    meals = c.fetchall()

    time_map = {
        "Breakfast": "08:00",
        "Lunch": "13:00",
        "Dinner": "19:00",
        "Snack": "16:00"
    }

    for m in meals:
        m["time"] = time_map.get(m["meal_type"], "-")

    # Hydration
    c.execute("""
        SELECT glasses FROM hydration_logs
        WHERE user_id=%s AND log_date=%s
    """, (user_id, date_q))
    h = c.fetchone()
    hydration = h["glasses"] if h else 0

    # Weekly Progress
    today = datetime.strptime(date_q, "%Y-%m-%d").date()
    monday = today - timedelta(days=today.weekday())

    weekly = []
    for i in range(7):
        d = monday + timedelta(days=i)
        c.execute("""
            SELECT COALESCE(SUM(caloric_value),0) total
            FROM food_logs
            WHERE user_id=%s AND log_date=%s
        """, (user_id, d))

        weekly.append({
            "day": d.strftime("%a")[0],
            "value": c.fetchone()["total"],
            "is_today": d == today
        })

    return jsonify({
        "user": session.get("user_name"),
        "intake": intake,
        "meals": meals,
        "hydration": hydration,
        "weekly": weekly
    })

@app.route("/api/add-water", methods=["POST"])
def add_water():
    if "user_id" not in session:
        return jsonify({"error":"unauthorized"}),401

    today = date.today()
    db = get_db()
    c = db.cursor()

    if USE_POSTGRES:
        upsert_sql = """
            INSERT INTO hydration_logs (user_id, log_date, glasses)
            VALUES (%s,%s,1)
            ON CONFLICT (user_id, log_date)
            DO UPDATE SET glasses = hydration_logs.glasses + 1
        """
    else:
        upsert_sql = """
            INSERT INTO hydration_logs (user_id, log_date, glasses)
            VALUES (%s,%s,1)
            ON DUPLICATE KEY UPDATE glasses = glasses + 1
        """
    c.execute(upsert_sql, (session["user_id"], today))

    db.commit()
    return jsonify({"status":"ok"})

TIP_CATEGORIES = [
    "hydration habit",
    "protein intake",
    "carbohydrate timing",
    "healthy fat",
    "portion control",
    "meal timing",
    "gut health",
    "mindful eating",
    "snack choice",
    "sleep and nutrition"
]

TIP_STYLES = [
    "practical advice",
    "simple habit",
    "did you know fact",
    "daily challenge",
    "common mistake to avoid"
]

@app.route("/api/daily-tip")
def daily_tip():
    if "user_id" not in session:
        return jsonify({"error": "unauthorized"}), 401

    if client is None:
        return jsonify({"error": "Set OPENAI_API_KEY in .env to use AI features"}), 503

    category = random.choice(TIP_CATEGORIES)
    style = random.choice(TIP_STYLES)

    try:
        res = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a nutrition coach. "
                        "Give concise, non-repetitive daily tips. "
                        "Avoid generic advice like 'eat more fruits and vegetables'."
                    )
                },
                {
                    "role": "user",
                    "content": (
                        f"Give ONE {style} nutrition tip about {category}. "
                        "Max 18 words. No emojis. No explanations."
                    )
                }
            ],
            reasoning_effort="low",
        )
        tip = (res.choices[0].message.content or "").strip()
        if not tip:
            raise ValueError("Empty tip")
    except OpenAIError:
        return jsonify({"error": "Layanan AI sedang tidak tersedia. Silakan coba lagi."}), 503
    except (AttributeError, IndexError, ValueError):
        return jsonify({"error": "Tip belum berhasil dibuat. Silakan coba lagi."}), 502

    return jsonify({
        "tip": tip,
        "date": date.today().isoformat()
    })

# SCAN FOOD
@app.route("/scanfood")
def scanfood():
    spa = frontend_index()
    if spa is not None:
        return spa
    if "user_id" not in session:
        return redirect("/")
    return render_template("scanfood.html")

# API SCAN FOOD
@app.route("/api/scan-food", methods=["POST"])
def api_scan_food():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    if not os.getenv("OPENAI_API_KEY"):
        return jsonify({"error": "Set OPENAI_API_KEY in .env to use AI features"}), 503

    data = request.get_json()
    image_data = data.get("image")

    if not image_data or "," not in image_data:
        return jsonify({"error": "Invalid image format"}), 400

    try:
        base64_image = image_data.split(",")[1]

        food_name = analyze_food_image(base64_image)

        nutrition = match_food(food_name)

        if not nutrition:
            return jsonify({
                "found": False,
                "food": food_name
            })

        return jsonify({
            "found": True,
            "nutrition": nutrition
        })

    except OpenAIError:
        return jsonify({"error": "Layanan AI sedang tidak tersedia. Silakan coba lagi."}), 503
    except Exception as exc:
        app.logger.error("Scan food failed: %s", type(exc).__name__)
        return jsonify({"error": "Scan failed"}), 500
    
@app.route("/api/add-food-log", methods=["POST"])
def add_food_log():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    nutrition = data.get("nutrition")
    image = data.get("image")

    if not nutrition:
        return jsonify({"error": "No nutrition data"}), 400

    image_path = None
    image_data = None
    image_mime = None
    if image:
        if not isinstance(image, str) or "," not in image:
            return jsonify({"error": "Format gambar tidak valid"}), 400
        header, encoded = image.split(",", 1)
        image_mime = header[5:-7] if header.startswith("data:") and header.endswith(";base64") else None
        if image_mime not in ("image/jpeg", "image/png", "image/webp"):
            return jsonify({"error": "Format gambar tidak didukung"}), 400
        try:
            image_data = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError):
            return jsonify({"error": "Data gambar tidak valid"}), 400
        if not image_data or len(image_data) > 2 * 1024 * 1024:
            return jsonify({"error": "Ukuran gambar maksimal 2 MB"}), 413

        if not USE_POSTGRES:
            # Local MariaDB keeps the existing file storage behaviour.
            os.makedirs("static/uploads", exist_ok=True)
            extension = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[image_mime]
            filename = f"{uuid.uuid4().hex}.{extension}"
            image_path = f"uploads/{filename}"
            with open(f"static/{image_path}", "wb") as f:
                f.write(image_data)

    db = get_db()
    cursor = db.cursor()

    columns = (
        "user_id", "food_name", "image_path", "caloric_value", "fat",
        "saturated_fats", "monounsaturated_fats", "polyunsaturated_fats",
        "carbohydrates", "sugars", "protein", "dietary_fiber", "cholesterol",
        "sodium", "water", "vitamin_a", "vitamin_b1", "vitamin_b11",
        "vitamin_b12", "vitamin_b2", "vitamin_b3", "vitamin_b5", "vitamin_b6",
        "vitamin_c", "vitamin_d", "vitamin_e", "vitamin_k", "calcium",
        "copper", "iron", "magnesium", "manganese", "phosphorus",
        "potassium", "selenium", "zinc", "nutrition_density", "log_date",
    )
    values = (
        session["user_id"],
        nutrition["food"],
        image_path,

        nutrition.get("caloric value"),
        nutrition.get("fat"),
        nutrition.get("saturated fats"),
        nutrition.get("monounsaturated fats"),
        nutrition.get("polyunsaturated fats"),
        nutrition.get("carbohydrates"),
        nutrition.get("sugars"),
        nutrition.get("protein"),
        nutrition.get("dietary fiber"),
        nutrition.get("cholesterol"),
        nutrition.get("sodium"),
        nutrition.get("water"),

        nutrition.get("vitamin a"),
        nutrition.get("vitamin b1"),
        nutrition.get("vitamin b11"),
        nutrition.get("vitamin b12"),
        nutrition.get("vitamin b2"),
        nutrition.get("vitamin b3"),
        nutrition.get("vitamin b5"),
        nutrition.get("vitamin b6"),
        nutrition.get("vitamin c"),
        nutrition.get("vitamin d"),
        nutrition.get("vitamin e"),
        nutrition.get("vitamin k"),

        nutrition.get("calcium"),
        nutrition.get("copper"),
        nutrition.get("iron"),
        nutrition.get("magnesium"),
        nutrition.get("manganese"),
        nutrition.get("phosphorus"),
        nutrition.get("potassium"),
        nutrition.get("selenium"),
        nutrition.get("zinc"),

        nutrition.get("nutrition density"),
        date.today(),
    )
    if USE_POSTGRES:
        columns += ("image_data", "image_mime")
        values += (image_data, image_mime)
    placeholders = ", ".join(["%s"] * len(columns))
    cursor.execute(
        f"INSERT INTO food_logs ({', '.join(columns)}) VALUES ({placeholders})",
        values,
    )

    db.commit()
    return jsonify({"status": "saved"})

# GENERATE MEAL PLAN
@app.route("/generate-plan", methods=["GET", "POST"])
def generateplan():
    if request.method == "GET":
        spa = frontend_index()
        if spa is not None:
            return spa
    if "user_id" not in session:
        return redirect("/")

    if request.method == "POST":
        meal_plan = request.get_json()
        if not isinstance(meal_plan, dict):
            return jsonify({"error": "Rencana makan tidak valid"}), 400
        save_plan_draft(session["user_id"], meal_plan)
        return jsonify({"status": "success"})

    return render_template("generate-plan.html")

@app.route("/api/generate-meal-plan", methods=["POST"])
def api_generate_meal_plan():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    if not os.getenv("OPENAI_API_KEY"):
        return jsonify({"error": "Set OPENAI_API_KEY in .env to use AI features"}), 503

    form = request.get_json(silent=True)
    if not isinstance(form, dict):
        return jsonify({"error": "Data profil belum lengkap"}), 400
    try:
        age = float(form["age"])
        weight = float(form["weight"])
        height = float(form["height"])
        gender = form["gender"]
        activity = form["activity"]
        preferences = form["preferences"]
    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "Data profil belum lengkap atau tidak valid"}), 400
    if (
        not 1 <= age <= 120 or not 1 <= weight <= 500 or not 50 <= height <= 280
        or gender not in ("male", "female")
        or activity not in ("sedentary", "lightly active", "moderately active", "very active")
        or not isinstance(preferences, list)
        or any(not isinstance(value, str) for value in preferences)
    ):
        return jsonify({"error": "Data profil belum lengkap atau tidak valid"}), 400
    form.update(age=age, weight=weight, height=height)

    try:
        plan = generate_meal_plan(form)
    except MealPlanResponseError as exc:
        return jsonify({"error": str(exc)}), 502
    except OpenAIError:
        return jsonify({"error": "Layanan AI sedang tidak tersedia. Silakan coba lagi."}), 503

    save_plan_draft(session["user_id"], plan)
    return jsonify(plan)

@app.route("/api/save-meal-plan", methods=["POST"])
def save_meal_plan():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    today = date.today()

    db = get_db()
    cursor = db.cursor()

    if USE_POSTGRES:
        upsert_sql = """
            INSERT INTO meal_plans (user_id, plan_date, calories, protein, carbs, fat)
            VALUES (%s,%s,%s,%s,%s,%s)
            ON CONFLICT (user_id, plan_date) DO UPDATE SET
              calories=EXCLUDED.calories,
              protein=EXCLUDED.protein,
              carbs=EXCLUDED.carbs,
              fat=EXCLUDED.fat
        """
    else:
        upsert_sql = """
            INSERT INTO meal_plans (user_id, plan_date, calories, protein, carbs, fat)
            VALUES (%s,%s,%s,%s,%s,%s)
            ON DUPLICATE KEY UPDATE
              calories=VALUES(calories),
              protein=VALUES(protein),
              carbs=VALUES(carbs),
              fat=VALUES(fat)
        """
    cursor.execute(upsert_sql, (
        session["user_id"],
        today,
        data["summary"]["calories"],
        data["summary"]["protein"],
        data["summary"]["carbs"],
        data["summary"]["fat"]
    ))

    cursor.execute("""
        SELECT id FROM meal_plans
        WHERE user_id=%s AND plan_date=%s
    """, (session["user_id"], today))
    plan_id = cursor.fetchone()[0]

    # hapus meal lama (kalau overwrite)
    cursor.execute("DELETE FROM meal_plan_meals WHERE plan_id=%s", (plan_id,))

    for meal in data["meals"]:
        insert_meal_sql = """
            INSERT INTO meal_plan_meals
            (plan_id, meal_type, title, description, calories)
            VALUES (%s,%s,%s,%s,%s)
        """
        if USE_POSTGRES:
            insert_meal_sql += " RETURNING id"
        cursor.execute(insert_meal_sql, (
            plan_id,
            meal["type"],
            meal["title"],
            meal["desc"],
            meal["calories"]
        ))

        meal_id = cursor.fetchone()[0] if USE_POSTGRES else cursor.lastrowid

        for item in meal["items"]:
            cursor.execute("""
                INSERT INTO meal_plan_items (meal_id, item_name)
                VALUES (%s,%s)
            """, (meal_id, item))

    cursor.execute("DELETE FROM meal_plan_drafts WHERE user_id=%s", (session["user_id"],))
    db.commit()
    return jsonify({"status": "saved"})

# FOOD LOG
@app.route("/food-log")
def foodlog():
    spa = frontend_index()
    if spa is not None:
        return spa
    if "user_id" not in session:
        return redirect("/")

    date_q = request.args.get("date")  # YYYY-MM-DD

    db = get_db()
    cursor = db.cursor(dictionary=True)
    columns = FOOD_LOG_PUBLIC_COLUMNS
    if USE_POSTGRES:
        columns += ", image_data IS NOT NULL AS has_image"

    if date_q:
        cursor.execute(
            f"SELECT {columns} FROM food_logs WHERE user_id=%s AND log_date=%s ORDER BY created_at DESC",
            (session["user_id"], date_q),
        )
    else:
        cursor.execute(
            f"SELECT {columns} FROM food_logs WHERE user_id=%s ORDER BY created_at DESC",
            (session["user_id"],),
        )

    logs = cursor.fetchall()
    if USE_POSTGRES:
        for log in logs:
            if log.pop("has_image"):
                log["image_url"] = f"/api/food-logs/{log['id']}/image"
    return render_template("food-log.html", logs=logs)


@app.route("/api/food-logs")
def api_food_logs():
    if "user_id" not in session:
        return jsonify({"error": "unauthorized"}), 401

    date_q = request.args.get("date")
    if date_q:
        try:
            parsed_date = datetime.strptime(date_q, "%Y-%m-%d").date()
            if parsed_date.isoformat() != date_q:
                raise ValueError("Invalid date")
        except ValueError:
            return jsonify({"error": "Tanggal harus menggunakan format YYYY-MM-DD"}), 400

    db = get_db()
    try:
        cursor = db.cursor(dictionary=True)
        columns = FOOD_LOG_PUBLIC_COLUMNS
        if USE_POSTGRES:
            columns += ", image_data IS NOT NULL AS has_image"
        if date_q:
            cursor.execute(
                f"SELECT {columns} FROM food_logs WHERE user_id=%s AND log_date=%s ORDER BY created_at DESC",
                (session["user_id"], date_q),
            )
        else:
            cursor.execute(
                f"SELECT {columns} FROM food_logs WHERE user_id=%s ORDER BY created_at DESC",
                (session["user_id"],),
            )
        logs = cursor.fetchall()
    finally:
        db.close()

    for log in logs:
        for key in ("log_date", "created_at"):
            if log.get(key) is not None:
                log[key] = log[key].isoformat()
        has_db_image = log.pop("has_image", False)
        if has_db_image:
            log["image_url"] = f"/api/food-logs/{log['id']}/image"
        else:
            log["image_url"] = f"/static/{log['image_path']}" if log.get("image_path") else None

    return jsonify(logs)


@app.route("/api/food-logs/<int:log_id>/image")
def api_food_log_image(log_id):
    if "user_id" not in session:
        return jsonify({"error": "unauthorized"}), 401
    if not USE_POSTGRES:
        return jsonify({"error": "image not found"}), 404

    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        "SELECT image_data, image_mime FROM food_logs WHERE id=%s AND user_id=%s",
        (log_id, session["user_id"]),
    )
    image = cursor.fetchone()
    if not image or not image["image_data"]:
        return jsonify({"error": "image not found"}), 404

    response = send_file(
        BytesIO(bytes(image["image_data"])),
        mimetype=image["image_mime"] or "image/jpeg",
    )
    response.cache_control.private = True
    response.cache_control.max_age = 3600
    return response

# MEAL PLAN
@app.route("/meal-plan")
def mealplan():
    spa = frontend_index()
    if spa is not None:
        return spa
    if "user_id" not in session:
        return redirect("/")

    meal_plan = load_plan_draft(session["user_id"])

    if not meal_plan:
        return render_template("meal-plan.html", empty=True)

    return render_template("meal-plan.html", meal_plan=meal_plan)


@app.route("/api/current-meal-plan")
def api_current_meal_plan():
    if "user_id" not in session:
        return jsonify({"error": "unauthorized"}), 401
    return jsonify(load_plan_draft(session["user_id"]))

@app.route("/api/meal-plans")
def api_meal_plans():
    if "user_id" not in session:
        return jsonify([])

    db = get_db()
    cursor = db.cursor(dictionary=True)

    cursor.execute("""
        SELECT * FROM meal_plans
        WHERE user_id=%s
        ORDER BY plan_date DESC
    """, (session["user_id"],))
    plans = cursor.fetchall()

    results = []

    for plan in plans:
        cursor.execute("""
            SELECT * FROM meal_plan_meals
            WHERE plan_id=%s
        """, (plan["id"],))
        meals = cursor.fetchall()

        meal_list = []
        for m in meals:
            cursor.execute("""
                SELECT item_name FROM meal_plan_items
                WHERE meal_id=%s
            """, (m["id"],))
            items = [i["item_name"] for i in cursor.fetchall()]

            meal_list.append({
                "type": m["meal_type"],
                "title": m["title"],
                "desc": m["description"],
                "calories": m["calories"],
                "items": items,
                "color": {
                    "Breakfast": "orange",
                    "Lunch": "blue",
                    "Dinner": "green",
                    "Snack": "purple"
                }.get(m["meal_type"], "gray")
            })

        results.append({
            "date": plan["plan_date"].strftime("%Y-%m-%d"),
            "summary": {
                "calories": plan["calories"],
                "protein": plan["protein"],
                "carbs": plan["carbs"],
                "fat": plan["fat"]
            },
            "meals": meal_list
        })

    return jsonify(results)

# REPORTS
@app.route("/reports")
def reports():
    spa = frontend_index()
    if spa is not None:
        return spa
    if "user_id" not in session:
        return redirect("/")
    return render_template("reports.html")

@app.route("/api/reports/weekly")
def api_weekly_report():
    if "user_id" not in session:
        return jsonify({"error": "unauthorized"}), 401

    db = get_db()
    c = db.cursor(dictionary=True)

    today = date.today()
    monday = today - timedelta(days=today.weekday())

    data = []
    for i in range(7):
        d = monday + timedelta(days=i)
        c.execute("""
            SELECT COALESCE(SUM(caloric_value),0) calories
            FROM food_logs
            WHERE user_id=%s AND log_date=%s
        """, (session["user_id"], d))

        data.append({
            "day": d.strftime("%a"),
            "calories": c.fetchone()["calories"]
        })

    # macros average
    c.execute("""
        SELECT
          COALESCE(AVG(protein),0) protein,
          COALESCE(AVG(carbohydrates),0) carbs,
          COALESCE(AVG(fat),0) fat
        FROM food_logs
        WHERE user_id=%s AND log_date BETWEEN %s AND %s
    """, (session["user_id"], monday, monday + timedelta(days=6)))

    macros = c.fetchone()

    return jsonify({
        "daily": data,
        "macros": macros
    })

@app.route("/api/reports/monthly")
def api_monthly_report():
    if "user_id" not in session:
        return jsonify({"error": "unauthorized"}), 401

    db = get_db()
    c = db.cursor(dictionary=True)

    today = date.today()
    first_day = today.replace(day=1)

    week_expression = "EXTRACT(WEEK FROM log_date)::integer" if USE_POSTGRES else "WEEK(log_date,1)"
    c.execute(f"""
        SELECT
          {week_expression} week,
          SUM(caloric_value) calories,
          COUNT(*) logs
        FROM food_logs
        WHERE user_id=%s AND log_date >= %s
        GROUP BY week
        ORDER BY week
    """, (session["user_id"], first_day))

    return jsonify(c.fetchall())

# LOGOUT
@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")


if __name__ == "__main__":
    app.run(debug=True)

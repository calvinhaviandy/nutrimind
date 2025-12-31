from flask import Flask, render_template, request, redirect, session, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_db
import random
from datetime import date, datetime, timedelta
import os, uuid
import base64
from vision import analyze_food_image
from food_data import match_food
from meal_engine import generate_meal_plan
from openai import OpenAI
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app = Flask(__name__)
app.secret_key = "nutrimind-secret-key"

# HOME / LANDING
@app.route("/")
def home():
    if "user_id" in session:
        return redirect("/dashboard")
    return render_template("landing.html")

# LOGIN
@app.route("/login", methods=["GET", "POST"])
def login():
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
    return render_template("landing.html")

# DASHBOARD
@app.route("/dashboard")
def dashboard():
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

    c.execute("""
        INSERT INTO hydration_logs (user_id, log_date, glasses)
        VALUES (%s,%s,1)
        ON DUPLICATE KEY UPDATE glasses = glasses + 1
    """, (session["user_id"], today))

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
    category = random.choice(TIP_CATEGORIES)
    style = random.choice(TIP_STYLES)

    res = client.chat.completions.create(
        model="gpt-4o-mini",
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
        temperature=1.2, 
        presence_penalty=0.8,
        frequency_penalty=0.6
    )

    return jsonify({
        "tip": res.choices[0].message.content.strip(),
        "date": date.today().isoformat()
    })

# SCAN FOOD
@app.route("/scanfood")
def scanfood():
    if "user_id" not in session:
        return redirect("/")
    return render_template("scanfood.html")

# API SCAN FOOD
@app.route("/api/scan-food", methods=["POST"])
def api_scan_food():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

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

    except Exception as e:
        print("SCAN FOOD ERROR:", e)
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
    if image and "," in image:
        img_bytes = base64.b64decode(image.split(",")[1])
        os.makedirs("static/uploads", exist_ok=True)
        filename = f"{uuid.uuid4().hex}.png"
        image_path = f"uploads/{filename}"

        with open(f"static/{image_path}", "wb") as f:
            f.write(img_bytes)

    db = get_db()
    cursor = db.cursor()

    cursor.execute("""
        INSERT INTO food_logs (
          user_id, food_name, image_path,
          caloric_value, fat, saturated_fats,
          monounsaturated_fats, polyunsaturated_fats,
          carbohydrates, sugars, protein, dietary_fiber,
          cholesterol, sodium, water,
          vitamin_a, vitamin_b1, vitamin_b11, vitamin_b12,
          vitamin_b2, vitamin_b3, vitamin_b5, vitamin_b6,
          vitamin_c, vitamin_d, vitamin_e, vitamin_k,
          calcium, copper, iron, magnesium, manganese,
          phosphorus, potassium, selenium, zinc,
          nutrition_density, log_date
        )
        VALUES (%s,%s,%s,
        %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
        %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
        %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (
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
        date.today()
    ))

    db.commit()
    return jsonify({"status": "saved"})

# GENERATE MEAL PLAN
@app.route("/generate-plan", methods=["GET", "POST"])
def generateplan():
    if "user_id" not in session:
        return redirect("/")

    if request.method == "POST":
        meal_plan = request.get_json()
        session["meal_plan"] = meal_plan
        return jsonify({"status": "success"})

    return render_template("generate-plan.html")

@app.route("/api/generate-meal-plan", methods=["POST"])
def api_generate_meal_plan():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    form = request.get_json()

    plan = generate_meal_plan(form)

    session["meal_plan"] = plan
    return jsonify(plan)

@app.route("/api/save-meal-plan", methods=["POST"])
def save_meal_plan():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    today = date.today()

    db = get_db()
    cursor = db.cursor()

    cursor.execute("""
        INSERT INTO meal_plans (user_id, plan_date, calories, protein, carbs, fat)
        VALUES (%s,%s,%s,%s,%s,%s)
        ON DUPLICATE KEY UPDATE
          calories=VALUES(calories),
          protein=VALUES(protein),
          carbs=VALUES(carbs),
          fat=VALUES(fat)
    """, (
        session["user_id"],
        today,
        data["summary"]["calories"],
        data["summary"]["protein"],
        data["summary"]["carbs"],
        data["summary"]["fat"]
    ))

    db.commit()

    cursor.execute("""
        SELECT id FROM meal_plans
        WHERE user_id=%s AND plan_date=%s
    """, (session["user_id"], today))
    plan_id = cursor.fetchone()[0]

    # hapus meal lama (kalau overwrite)
    cursor.execute("DELETE FROM meal_plan_meals WHERE plan_id=%s", (plan_id,))
    db.commit()

    for meal in data["meals"]:
        cursor.execute("""
            INSERT INTO meal_plan_meals
            (plan_id, meal_type, title, description, calories)
            VALUES (%s,%s,%s,%s,%s)
        """, (
            plan_id,
            meal["type"],
            meal["title"],
            meal["desc"],
            meal["calories"]
        ))

        meal_id = cursor.lastrowid

        for item in meal["items"]:
            cursor.execute("""
                INSERT INTO meal_plan_items (meal_id, item_name)
                VALUES (%s,%s)
            """, (meal_id, item))

    db.commit()
    return jsonify({"status": "saved"})

# FOOD LOG
@app.route("/food-log")
def foodlog():
    if "user_id" not in session:
        return redirect("/")

    date_q = request.args.get("date")  # YYYY-MM-DD

    db = get_db()
    cursor = db.cursor(dictionary=True)

    if date_q:
        cursor.execute("""
            SELECT * FROM food_logs
            WHERE user_id=%s AND log_date=%s
            ORDER BY created_at DESC
        """, (session["user_id"], date_q))
    else:
        cursor.execute("""
            SELECT * FROM food_logs
            WHERE user_id=%s
            ORDER BY created_at DESC
        """, (session["user_id"],))

    logs = cursor.fetchall()
    return render_template("food-log.html", logs=logs)

# MEAL PLAN
@app.route("/meal-plan")
def mealplan():
    if "user_id" not in session:
        return redirect("/")

    meal_plan = session.get("meal_plan")

    if not meal_plan:
        return render_template("meal-plan.html", empty=True)

    return render_template("meal-plan.html", meal_plan=meal_plan)

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

    c.execute("""
        SELECT
          WEEK(log_date,1) week,
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

-- Nutrimind schema for MySQL / MariaDB.
-- Safe to rerun: creates only a missing database or missing tables.
CREATE DATABASE IF NOT EXISTS nutrimind
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE nutrimind;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS food_logs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  food_name VARCHAR(255) NOT NULL,
  image_path VARCHAR(512) NULL,
  caloric_value DOUBLE NULL,
  fat DOUBLE NULL,
  saturated_fats DOUBLE NULL,
  monounsaturated_fats DOUBLE NULL,
  polyunsaturated_fats DOUBLE NULL,
  carbohydrates DOUBLE NULL,
  sugars DOUBLE NULL,
  protein DOUBLE NULL,
  dietary_fiber DOUBLE NULL,
  cholesterol DOUBLE NULL,
  sodium DOUBLE NULL,
  water DOUBLE NULL,
  vitamin_a DOUBLE NULL,
  vitamin_b1 DOUBLE NULL,
  vitamin_b11 DOUBLE NULL,
  vitamin_b12 DOUBLE NULL,
  vitamin_b2 DOUBLE NULL,
  vitamin_b3 DOUBLE NULL,
  vitamin_b5 DOUBLE NULL,
  vitamin_b6 DOUBLE NULL,
  vitamin_c DOUBLE NULL,
  vitamin_d DOUBLE NULL,
  vitamin_e DOUBLE NULL,
  vitamin_k DOUBLE NULL,
  calcium DOUBLE NULL,
  copper DOUBLE NULL,
  iron DOUBLE NULL,
  magnesium DOUBLE NULL,
  manganese DOUBLE NULL,
  phosphorus DOUBLE NULL,
  potassium DOUBLE NULL,
  selenium DOUBLE NULL,
  zinc DOUBLE NULL,
  nutrition_density DOUBLE NULL,
  log_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_food_logs_user_date (user_id, log_date),
  CONSTRAINT fk_food_logs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hydration_logs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  log_date DATE NOT NULL,
  glasses INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_hydration_user_date (user_id, log_date),
  CONSTRAINT fk_hydration_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS meal_plans (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  plan_date DATE NOT NULL,
  calories DOUBLE NOT NULL DEFAULT 0,
  protein DOUBLE NOT NULL DEFAULT 0,
  carbs DOUBLE NOT NULL DEFAULT 0,
  fat DOUBLE NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_meal_plans_user_date (user_id, plan_date),
  CONSTRAINT fk_meal_plans_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS meal_plan_meals (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  plan_id INT UNSIGNED NOT NULL,
  meal_type VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  calories DOUBLE NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_meal_plan_meals_plan (plan_id),
  CONSTRAINT fk_meal_plan_meals_plan FOREIGN KEY (plan_id) REFERENCES meal_plans (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS meal_plan_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  meal_id INT UNSIGNED NOT NULL,
  item_name VARCHAR(512) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_meal_plan_items_meal (meal_id),
  CONSTRAINT fk_meal_plan_items_meal FOREIGN KEY (meal_id) REFERENCES meal_plan_meals (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS meal_plan_drafts (
  user_id INT UNSIGNED NOT NULL,
  plan_json LONGTEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_meal_plan_drafts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

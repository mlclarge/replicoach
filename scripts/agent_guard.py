#!/usr/bin/env python3
"""AGENT GUARD & AUDITOR UNIVERSEL V3.0 (MULTI-SOURCES)

- Prise en charge de multiples sources de coûts (Gemini API CSV/TXT + Abonnements fixes Copilot).
- Réconciliation automatique avec l'historique local de Cline.
- Génération du rapport d'audit et de diagnostic R&D.
"""

import csv
import json
import os
import re
import sys

IGNORE_CONTENT = """# PROTECTION TOKENS & SÉCURITÉ UNIVERSELLE
node_modules/
.venv/
venv/
env/
__pycache__/
*.pyc
dist/
build/
out/
.next/
.nuxt/
*.sqlite
*.db
*.csv
*.xlsx
*.pdf
*.png
*.jpg
*.log
.git/
"""

RULES_CONTENT = """# RÈGLES DE DÉVELOPPEMENT AGENTIC
1. COMMANDES TERMINAL SILENCIEUSES : npm/yarn avec `--silent`, pytest avec `--tb=short -q`.
2. LECTURE DE FICHIERS : Ne lisez jamais de répertoires entiers ni de dépendances.
3. RÈGLE DES 15 TOURS : Réinitialisez la session au-delà de 15-20 messages.
4. ISOLATION R&D : Testez les nouvelles bibliothèques lourdes dans un dossier temporaire isolé.
"""


def setup_protections(project_root):
  print(f"🔒 [1/3] Application des garde-fous sur : {project_root}")
  for fname in [".clineignore", ".cursorignore", ".aiderignore"]:
    path = os.path.join(project_root, fname)
    if not os.path.exists(path):
      with open(path, "w", encoding="utf-8") as f:
        f.write(IGNORE_CONTENT)

  for fname in [".clinerules", "AGENT_RULES.md"]:
    path = os.path.join(project_root, fname)
    if not os.path.exists(path):
      with open(path, "w", encoding="utf-8") as f:
        f.write(RULES_CONTENT)


def locate_cline_tasks():
  home = os.path.expanduser("~")
  paths = [
      os.path.join(
          home,
          "AppData",
          "Roaming",
          "Code",
          "User",
          "globalStorage",
          "saoudrizwan.claude-dev",
          "tasks",
      ),
      os.path.join(
          home,
          "Library",
          "Application Support",
          "Code",
          "User",
          "globalStorage",
          "saoudrizwan.claude-dev",
          "tasks",
      ),
      os.path.join(
          home,
          ".config",
          "Code",
          "User",
          "globalStorage",
          "saoudrizwan.claude-dev",
          "tasks",
      ),
  ]
  return next((p for p in paths if os.path.exists(p)), None)


def collect_cost_sources():
  """Permet à l'utilisateur de déclarer plusieurs sources de coûts."""
  total_fixed_cost = 0.0
  parsed_task_costs = []

  print("\n💳 [2/3] SAISIE ET AGREGATION DES SOURCES DE COUTS")
  print("--------------------------------------------------")

  # 1. Ajout d'abonnements fixes (ex: GitHub Copilot)
  add_fixed = (
      input("👉 Souhaitez-vous ajouter un abonnement fixe (ex: Copilot) ? (o/N)"
            " : ")
      .strip()
      .lower()
  )
  while add_fixed == "o":
    label = input("   Nom du service (ex: GitHub Copilot Pro) : ").strip()
    try:
      amount = float(
          input(f"   Montant total pour la période (USD) : ").strip()
      )
      total_fixed_cost += amount
      print(f"   ✅ Ajouté : {label} = ${amount:.2f} USD")
    except ValueError:
      print("   ⚠️ Montant invalide.")
    add_fixed = (
        input("👉 Ajouter un autre abonnement fixe ? (o/N) : ").strip().lower()
    )

  # 2. Ajout de fichiers de détails API (Gemini, etc.)
  add_file = (
      input(
          "\n👉 Souhaitez-vous charger un fichier de détail de coûts (CSV/TXT)"
          " ? (o/N) : "
      )
      .strip()
      .lower()
  )
  while add_file == "o":
    fpath = input("   Glissez le fichier ici (ou tapez le chemin) : ").strip(
        ' "'
    )
    if os.path.exists(fpath):
      try:
        with open(fpath, "r", encoding="utf-8-sig", errors="ignore") as f:
          content = f.read()
          found = [float(x) for x in re.findall(r"\$(\d+\.\d+)", content)]
          if found:
            parsed_task_costs.extend(found)
            print(
                f"   ✅ {len(found)} montants d'appels API extraits (Total :"
                f" ${sum(found):.4f} USD)"
            )
          else:
            print("   ⚠️ Aucun montant au format '$XX.XX' trouvé.")
      except Exception as e:
        print(f"   ⚠️ Erreur de lecture : {e}")
    else:
      print("   ⚠️ Fichier introuvable.")
    add_file = (
        input("👉 Ajouter un autre fichier de détail ? (o/N) : ")
        .strip()
        .lower()
    )

  return total_fixed_cost, parsed_task_costs


def run_audit(project_root):
  fixed_costs, task_costs = collect_cost_sources()
  tasks_dir = locate_cline_tasks()

  if not tasks_dir:
    print("⚠️ Répertoire local des tâches Cline introuvable.")
    return

  task_folders = [
      os.path.join(tasks_dir, f)
      for f in os.listdir(tasks_dir)
      if os.path.isdir(os.path.join(tasks_dir, f))
  ]

  sessions = []
  for folder in task_folders:
    meta_path = os.path.join(folder, "task_metadata.json")
    hist_path = os.path.join(folder, "api_conversation_history.json")

    cost = 0.0
    msg_count = 0
    first_prompt = "N/A"
    created_at = "N/A"

    if os.path.exists(meta_path):
      try:
        with open(meta_path, "r", encoding="utf-8") as f:
          meta = json.load(f)
          cost = meta.get("totalCost", 0.0) or meta.get("cost", 0.0) or 0.0
          created_at = meta.get("createdAt", "N/A")
      except Exception:
        pass

    if os.path.exists(hist_path):
      try:
        with open(hist_path, "r", encoding="utf-8") as f:
          history = json.load(f)
          msg_count = len(history)
          for msg in history:
            if msg.get("role") == "user" and first_prompt == "N/A":
              content = msg.get("content", [])
              if isinstance(content, str):
                first_prompt = content.strip().replace("\n", " ")[:120]
              elif isinstance(content, list):
                for b in content:
                  if isinstance(b, dict) and b.get("type") == "text":
                    first_prompt = (
                        b.get("text", "").strip().replace("\n", " ")[:120]
                    )
                    break
      except Exception:
        pass

    sessions.append({
        "id": os.path.basename(folder),
        "date": created_at,
        "cost": cost,
        "messages": msg_count,
        "prompt": first_prompt,
    })

  sessions.sort(key=lambda x: x["date"], reverse=True)

  # Attribution des coûts extraits si besoin
  if task_costs:
    for i in range(min(len(sessions), len(task_costs))):
      if sessions[i]["cost"] == 0.0:
        sessions[i]["cost"] = task_costs[i]

  sessions.sort(key=lambda x: x["cost"], reverse=True)
  total_api_cost = sum(s["cost"] for s in sessions)
  total_overall = fixed_costs + total_api_cost

  print("\n📊 [3/3] RECAPITULATIF ET BILAN GLOBAL")
  print("--------------------------------------------------")
  print(f"  • Abonnements fixes (ex: Copilot) : ${fixed_costs:.2f} USD")
  print(f"  • Consommation API Gemini (Cline) : ${total_api_cost:.4f} USD")
  print(f"  • BUDGET TOTAL BRUT CUMULÉ        : ${total_overall:.4f} USD")

  # Export du bilan CSV
  csv_path = os.path.join(project_root, "cline_audit_report.csv")
  with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.writer(f)
    writer.writerow(
        ["Task_ID", "Date", "Cost_USD", "Messages_Count", "First_Prompt"]
    )
    for s in sessions:
      writer.writerow(
          [s["id"], s["date"], s["cost"], s["messages"], s["prompt"]]
      )

  print(f"\n📄 Audit mis à jour dans : {csv_path}")


if __name__ == "__main__":
  root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
  setup_protections(root)
  run_audit(root)
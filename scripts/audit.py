#!/usr/bin/env python3
"""AUDITEUR UNIVERSEL DE SESSIONS AGENT LLM (Cline / Claude Dev / Cursor)

Parcourt les historiques de conversations d'agents, extrait les métadonnées,
croise les coûts d'API externes et génère un rapport CSV/Texte universel.
"""

import csv
import json
import os
import re
import sys


def locate_tasks_directory(custom_path=None):
  """Localise automatiquement le dossier de stockage des tâches selon l'OS."""
  if custom_path and os.path.exists(custom_path):
    return custom_path

  home = os.path.expanduser("~")
  possible_paths = [
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
  return next((p for p in possible_paths if os.path.exists(p)), None)


def parse_cost_file(file_path):
  """Extrait les montants financiers ($XX.XX) d'un fichier de détail de coûts (CSV/TXT)."""
  costs = []
  if not file_path or not os.path.exists(file_path):
    return costs

  try:
    with open(file_path, "r", encoding="utf-8-sig", errors="ignore") as f:
      content = f.read()
      matches = re.findall(r"\$(\d+\.\d+)", content)
      if matches:
        costs = [float(x) for x in matches]
  except Exception as e:
    print(f"⚠️ Erreur lors de la lecture du fichier de coûts : {e}")
  return costs


def audit_agent_sessions(
    tasks_dir, cost_file=None, fixed_copilot=20.0, output_dir="output"
):
  """Audite toutes les tâches locales, réconcilie les coûts et génère le bilan."""
  os.makedirs(output_dir, exist_ok=True)
  tasks_dir = locate_tasks_directory(tasks_dir)

  if not tasks_dir or not os.path.exists(tasks_dir):
    print("❌ Dossier de tâches introuvable.")
    return

  external_costs = parse_cost_file(cost_file) if cost_file else []
  task_folders = [
      os.path.join(tasks_dir, f)
      for f in os.listdir(tasks_dir)
      if os.path.isdir(os.path.join(tasks_dir, f))
  ]

  print(f"🔍 Analyse de {len(task_folders)} tâches locales...")
  summary_data = []

  for folder in task_folders:
    folder_id = os.path.basename(folder)
    meta_file = os.path.join(folder, "task_metadata.json")
    hist_file = os.path.join(folder, "api_conversation_history.json")

    cost = 0.0
    msg_count = 0
    first_prompt = "N/A"
    created_at = "N/A"
    tools_used = set()
    read_files_count = 0

    if os.path.exists(meta_file):
      try:
        with open(meta_file, "r", encoding="utf-8") as f:
          meta = json.load(f)
          cost = meta.get("totalCost", 0.0) or meta.get("cost", 0.0) or 0.0
          created_at = meta.get("createdAt", "N/A")
      except Exception:
        pass

    if os.path.exists(hist_file):
      try:
        with open(hist_file, "r", encoding="utf-8") as f:
          history = json.load(f)
          msg_count = len(history)

          for msg in history:
            role = msg.get("role")
            content = msg.get("content", [])

            if role == "user" and first_prompt == "N/A":
              if isinstance(content, str):
                first_prompt = content.strip().replace("\n", " ")[:120]
              elif isinstance(content, list):
                for b in content:
                  if isinstance(b, dict) and b.get("type") == "text":
                    first_prompt = (
                        b.get("text", "").strip().replace("\n", " ")[:120]
                    )
                    break

            if role == "assistant" and isinstance(content, list):
              for b in content:
                if isinstance(b, dict) and b.get("type") == "tool_use":
                  tool = b.get("name", "inconnu")
                  tools_used.add(tool)
                  if tool == "read_file":
                    read_files_count += 1
      except Exception:
        pass

    summary_data.append({
        "task_id": folder_id,
        "created_at": created_at,
        "cost_usd": round(cost, 4),
        "message_count": msg_count,
        "read_files_count": read_files_count,
        "tools_used": ", ".join(tools_used),
        "first_prompt": first_prompt,
    })

  # Tri chronologique inverse pour caler les coûts externes si besoin
  summary_data.sort(key=lambda x: x["created_at"], reverse=True)

  if external_costs:
    for i in range(min(len(summary_data), len(external_costs))):
      if summary_data[i]["cost_usd"] == 0.0:
        summary_data[i]["cost_usd"] = external_costs[i]

  # Tri par coût décroissant pour le diagnostic
  summary_data.sort(key=lambda x: x["cost_usd"], reverse=True)

  total_api_usd = sum(item["cost_usd"] for item in summary_data)
  total_project_usd = total_api_usd + fixed_copilot

  # Export CSV
  csv_path = os.path.join(output_dir, "audit_summary.csv")
  with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.DictWriter(
        f,
        fieldnames=[
            "task_id",
            "created_at",
            "cost_usd",
            "message_count",
            "read_files_count",
            "tools_used",
            "first_prompt",
        ],
    )
    writer.writeheader()
    writer.writerows(summary_data)

  # Export Rapport Texte
  report_path = os.path.join(output_dir, "report.txt")
  with open(report_path, "w", encoding="utf-8") as f:
    f.write("====================================================\n")
    f.write("         RAPPORT D'AUDIT LLM UNIVERSEL              \n")
    f.write("====================================================\n\n")
    f.write(f"Tâches analysées            : {len(summary_data)}\n")
    f.write(f"Coût API consommé (Gemini) : ${total_api_usd:.4f} USD\n")
    f.write(f"Abonnement fixe (Copilot)   : ${fixed_copilot:.2f} USD\n")
    f.write(f"CUMUL TOTAL ESTIMÉ         : ${total_project_usd:.4f} USD\n\n")

    f.write("--- TOP 5 DES TÂCHES LES PLUS COÛTEUSES ---\n")
    for item in summary_data[:5]:
      pct = (
          (item["cost_usd"] / total_api_usd * 100) if total_api_usd > 0 else 0
      )
      f.write(
          f"ID Task     : {item['task_id']} ({pct:.1f}% du budget API)\n"
      )
      f.write(f"Date        : {item['created_at']}\n")
      f.write(f"Coût ($ USD) : ${item['cost_usd']:.4f}\n")
      f.write(f"Messages    : {item['message_count']}\n")
      f.write(f"Fichiers lus: {item['read_files_count']}\n")
      f.write(f"Outils      : {item['tools_used']}\n")
      f.write(f"First Prompt: {item['first_prompt']}...\n")
      f.write("-" * 52 + "\n")

  print("✅ Audit terminé.")
  print(f"📊 Fichier CSV généré : {csv_path}")
  print(f"📄 Rapport récapitulatif : {report_path}")


if __name__ == "__main__":
  print("=== AUDITEUR UNIVERSEL DE PROMPTING IA ===")
  tasks_in = input("Chemin du dossier tasks [Laissez vide pour auto] : ").strip()
  cost_file_in = input(
      "Chemin du fichier de coût (ex: clineGemini.txt) : "
  ).strip(' "')
  copilot_in = input("Montant fixe Copilot Pro (USD) [Défaut 20.0] : ").strip()

  copilot_val = float(copilot_in) if copilot_in else 20.0
  audit_agent_sessions(
      tasks_in if tasks_in else None,
      cost_file_in if cost_file_in else None,
      copilot_val,
  )
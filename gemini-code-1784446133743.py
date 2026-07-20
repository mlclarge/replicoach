import re
user_chars = []
user_aliases = {}
for item in characters_str.split(','):
    item = item.strip()
    match = re.match(r"^(.*?)\s*\((.*?)\)$", item)
    if match:
        main_name = match.group(1).strip()
        alias = match.group(2).strip()
        user_chars.append(main_name)
        user_aliases[alias] = main_name
    else:
        user_chars.append(item)
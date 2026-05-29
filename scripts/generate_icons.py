import os
from PIL import Image, ImageDraw, ImageFont

root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
public_icons = os.path.join(root, 'public', 'icons')
os.makedirs(public_icons, exist_ok=True)

background_color = (15, 23, 42)
foreground_color = (236, 255, 255)

try:
    font = ImageFont.truetype('arial.ttf', 160)
except Exception:
    font = ImageFont.load_default()

for size in [192, 512]:
    img = Image.new('RGB', (size, size), background_color)
    draw = ImageDraw.Draw(img)
    text = 'P'
    text_width, text_height = draw.textsize(text, font=font)
    x = (size - text_width) / 2
    y = (size - text_height) / 2 - size * 0.05
    draw.text((x, y), text, font=font, fill=foreground_color)
    img.save(os.path.join(public_icons, f'icon-{size}.png'))

mipmap_sizes = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
}
res_root = os.path.join(root, 'android', 'app', 'src', 'main', 'res')
for folder, size in mipmap_sizes.items():
    target_dir = os.path.join(res_root, folder)
    if not os.path.isdir(target_dir):
        continue
    for name in ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']:
        if name == 'ic_launcher_foreground.png':
            img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
            draw = ImageDraw.Draw(img)
            text = 'P'
            text_width, text_height = draw.textsize(text, font=font)
            x = (size - text_width) / 2
            y = (size - text_height) / 2 - size * 0.05
            draw.text((x, y), text, font=font, fill=(255, 255, 255, 255))
        else:
            img = Image.new('RGB', (size, size), background_color)
            draw = ImageDraw.Draw(img)
            text = 'P'
            text_width, text_height = draw.textsize(text, font=font)
            x = (size - text_width) / 2
            y = (size - text_height) / 2 - size * 0.05
            draw.text((x, y), text, font=font, fill=foreground_color)
        img.save(os.path.join(target_dir, name))

# update the adaptive icon background color resource
colors_xml = os.path.join(res_root, 'values', 'ic_launcher_background.xml')
with open(colors_xml, 'w', encoding='utf-8') as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0F172A</color>\n</resources>\n')

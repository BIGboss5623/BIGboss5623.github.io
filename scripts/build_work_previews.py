"""Generate lightweight display copies; preserve the original credit images."""
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]

for number in (1, 2):
    source = ROOT / 'assets' / 'images' / f'chuangtou-work-{number}.png'
    target = source.with_name(f'chuangtou-work-{number}-preview.webp')
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original).convert('RGB')
        image.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
        image.save(target, 'WEBP', quality=85, method=6)
        print(f'{target.name}: {source.stat().st_size} -> {target.stat().st_size} bytes; {image.size}')

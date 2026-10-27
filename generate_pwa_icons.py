import zlib
import struct
import math
import os

def create_png(width, height, pixels):
    """
    pixels: list of rows, each row is a list of (R, G, B, A) tuples.
    """
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))

    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0)  # Filter byte (None)
        for x in range(width):
            r, g, b, a = pixels[y][x]
            raw_data.extend((r, g, b, a))

    idat = chunk(b'IDAT', zlib.compress(bytes(raw_data), 9))
    iend = chunk(b'IEND', b'')
    return header + ihdr + idat + iend

def generate_flask_icon(size):
    # Colors
    bg_r, bg_g, bg_b = 37, 99, 235       # #2563EB Primary Blue
    white_r, white_g, white_b = 255, 255, 255
    cyan_r, cyan_g, cyan_b = 56, 189, 248 # Accent liquid inside flask

    pixels = []
    center_x = size / 2.0
    center_y = size / 2.0
    corner_radius = size * 0.22

    for y in range(size):
        row = []
        for x in range(size):
            # Rounded squircle background
            dx = max(abs(x - center_x) - (size/2.0 - corner_radius), 0)
            dy = max(abs(y - center_y) - (size/2.0 - corner_radius), 0)
            dist_to_corner = math.sqrt(dx*dx + dy*dy)

            if dist_to_corner > corner_radius:
                # Transparent outside squircle
                row.append((0, 0, 0, 0))
                continue

            # Normalized coordinates inside icon [-1, 1]
            nx = (x - center_x) / (size * 0.4)
            ny = (y - center_y) / (size * 0.4)

            # Draw Lab Flask:
            # Flask neck: abs(nx) <= 0.18 and -0.85 <= ny <= -0.2
            # Flask lip/rim: abs(nx) <= 0.28 and -0.92 <= ny <= -0.82
            # Flask body: triangle expanding from ny=-0.2 to ny=0.75, width up to 0.75
            # Flask bottom: rounded base at ny=0.75

            in_rim = (abs(nx) <= 0.28 and -0.92 <= ny <= -0.82)
            in_neck = (abs(nx) <= 0.16 and -0.85 <= ny <= -0.15)
            
            in_body = False
            if -0.15 < ny <= 0.72:
                # Width expands linearly
                body_half_w = 0.16 + (ny - (-0.15)) / (0.72 - (-0.15)) * (0.68 - 0.16)
                if abs(nx) <= body_half_w:
                    in_body = True

            in_base = False
            if 0.70 < ny <= 0.80:
                base_w = 0.68 - (ny - 0.70) * 0.5
                if abs(nx) <= base_w:
                    in_base = True

            in_flask_outer = in_rim or in_neck or in_body or in_base

            # Inner cutout / liquid
            in_liquid = False
            if 0.15 <= ny <= 0.72 and in_body:
                in_liquid = True
            elif 0.70 < ny <= 0.77 and in_base:
                in_liquid = True

            # Bubble inside liquid
            b1 = math.sqrt((nx - 0.18)**2 + (ny - 0.38)**2) <= 0.08
            b2 = math.sqrt((nx + 0.15)**2 + (ny - 0.52)**2) <= 0.06

            if in_flask_outer:
                if b1 or b2:
                    row.append((white_r, white_g, white_b, 255))
                elif in_liquid:
                    row.append((cyan_r, cyan_g, cyan_b, 255))
                else:
                    row.append((white_r, white_g, white_b, 255))
            else:
                row.append((bg_r, bg_g, bg_b, 255))
        pixels.append(row)

    return create_png(size, size, pixels)

def generate_svg():
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#2563EB"/>
  <!-- Flask Body & Neck -->
  <path d="M216 110 h80 v115 l95 155 a32 32 0 0 1 -27 48 H148 a32 32 0 0 1 -27 -48 l95 -155 Z" fill="#FFFFFF"/>
  <!-- Flask Lip/Rim -->
  <rect x="200" y="90" width="112" height="24" rx="12" fill="#FFFFFF"/>
  <!-- Chemical Liquid -->
  <path d="M175 320 l65 -15 c30 5 45 5 75 -10 l22 35 a24 24 0 0 1 -3 28 l-5 8 a24 24 0 0 1 -20 10 H203 a24 24 0 0 1 -20 -10 Z" fill="#38BDF8"/>
  <circle cx="280" cy="360" r="14" fill="#FFFFFF" opacity="0.9"/>
  <circle cx="230" cy="385" r="10" fill="#FFFFFF" opacity="0.9"/>
  <!-- Measurement ticks -->
  <line x1="285" y1="260" x2="305" y2="260" stroke="#2563EB" stroke-width="6" stroke-linecap="round"/>
  <line x1="270" y1="290" x2="295" y2="290" stroke="#2563EB" stroke-width="6" stroke-linecap="round"/>
</svg>'''

if __name__ == '__main__':
    os.makedirs('frontend/public', exist_ok=True)
    
    # Generate SVG
    svg_content = generate_svg()
    with open('frontend/public/icon.svg', 'w', encoding='utf-8') as f:
        f.write(svg_content)
    with open('frontend/public/favicon.svg', 'w', encoding='utf-8') as f:
        f.write(svg_content)
    print("SVG icons generated.")

    # Generate PNGs
    for size, filename in [
        (192, 'frontend/public/pwa-192x192.png'),
        (512, 'frontend/public/pwa-512x512.png'),
        (180, 'frontend/public/apple-touch-icon.png')
    ]:
        png_data = generate_flask_icon(size)
        with open(filename, 'wb') as f:
            f.write(png_data)
        print(f"Generated {filename} ({size}x{size})")

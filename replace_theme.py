import os
import glob

html_files = glob.glob(os.path.join(r"c:\Users\mariu\Nettside", "*.html"))

global_bg = """    <!-- Global Animated Background -->
    <div class="global-background">
        <div class="ambient-bg">
            <div class="ambient-orb orb-1"></div>
            <div class="ambient-orb orb-2"></div>
            <div class="ambient-orb orb-3"></div>
        </div>
        <div class="interactive-glow"></div>
        <div class="premium-grid"></div>
        <div class="particles-container">
            <div class="particle p1"></div>
            <div class="particle p2"></div>
            <div class="particle p3"></div>
            <div class="particle p4"></div>
            <div class="particle p5"></div>
            <div class="particle p6"></div>
            <div class="particle p7"></div>
            <div class="particle p8"></div>
            <div class="particle p9"></div>
            <div class="particle p10"></div>
        </div>
    </div>"""

global_bg_variant = """    <!-- Global Animated Background -->
    <div class="global-background">
        <div class="ambient-bg">
            <div class="ambient-orb orb-1"></div>
            <div class="ambient-orb orb-2"></div>
            <div class="ambient-orb orb-3"></div>
        </div>
        <div class="interactive-glow"></div>
        <div class="premium-grid"></div>
    </div>"""

old_footer = 'color: rgba(255,255,255,0.4);'
new_footer = 'color: var(--text-muted);'
old_logo = 'color: #fff;'
new_logo = 'color: var(--text-color);'

for f in html_files:
    if f.endswith("index.html") or f.endswith("tjenester.html"): 
        # Already processed or partially processed inline, but footer is fine to run
        pass
        
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # Only remove global background safely if present
    content = content.replace(global_bg + "\n", "")
    content = content.replace(global_bg, "")
    content = content.replace(global_bg_variant + "\n", "")
    content = content.replace(global_bg_variant, "")
    
    # footer fix
    content = content.replace(old_footer, new_footer)
    
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)
        
print("Replacement complete")

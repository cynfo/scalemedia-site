$files = @("design-og-innhold.html", "nettsider.html", "sokemotoroptimalisering.html", "google-ads.html", "sosiale-medier.html", "medieradgivning.html", "avtalevilkar.html")

$old_bg = @"
    <!-- Global Animated Background -->
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
    </div>
"@

$new_bg = @"
    <div class="light-ambient-bg">
        <div class="light-orb light-orb-1"></div>
        <div class="light-orb light-orb-2"></div>
        <div class="light-orb light-orb-3"></div>
    </div>
"@

$old_footer = 'color: rgba(255,255,255,0.4);'
$new_footer = 'color: var(--text-muted);'

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content -Raw -Encoding UTF8 $file
        $content = $content.Replace($old_bg, $new_bg)
        $content = $content.Replace($old_bg.Trim(), $new_bg.Trim())
        $content = $content.Replace($old_footer, $new_footer)
        Set-Content -Path $file -Value $content -Encoding UTF8 -NoNewline
    }
}
Write-Output "Done replacing theme across other files."

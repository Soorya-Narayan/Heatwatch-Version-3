#!/usr/bin/env python3
import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, KeepTogether, PageBreak, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_header_footer(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_header_footer(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))

        # Skip header on cover page (Page 1)
        if self._pageNumber > 1:
            self.drawString(54, 750, "HeatWatch 3 — Industrial Temperature Telemetry & Control System")
            self.setStrokeColor(colors.HexColor("#cbd5e1"))
            self.setLineWidth(0.5)
            self.line(54, 744, 558, 744)

        # Footer on all pages
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 36, page_text)
        self.drawString(54, 36, "CONFIDENTIAL & PROPRIETARY — GOOSE INDUSTRIAL SYSTEMS")
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(54, 48, 558, 48)

        self.restoreState()

def create_heatwatch_manual(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Custom Color Palette
    primary_color = colors.HexColor("#0e7490") # Industrial Cyan
    secondary_color = colors.HexColor("#0f172a") # Slate Dark
    text_dark = colors.HexColor("#1e293b")
    alarm_red = colors.HexColor("#dc2626")
    warning_yellow = colors.HexColor("#d97706")
    normal_green = colors.HexColor("#10b981")
    bg_light = colors.HexColor("#f8fafc")

    # Custom Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=secondary_color,
        spaceAfter=6
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=primary_color,
        spaceAfter=14
    )

    heading1_style = ParagraphStyle(
        'SectionHeading1',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=secondary_color,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )

    heading2_style = ParagraphStyle(
        'SectionHeading2',
        parent=styles['Heading3'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=primary_color,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=text_dark,
        spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        'BulletCustom',
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4
    )

    code_style = ParagraphStyle(
        'CodeStyle',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#0f172a"),
        backColor=colors.HexColor("#f1f5f9"),
        borderColor=colors.HexColor("#cbd5e1"),
        borderWidth=0.5,
        borderPadding=6,
        spaceBefore=4,
        spaceAfter=6
    )

    story = []

    # ---------------------------------------------------------
    # COVER / HEADER BANNER
    # ---------------------------------------------------------
    banner_path = "/Users/suryanarayan/Documents/Projects/Work/HeatWatch3/GooseBanner.jpeg"
    if os.path.exists(banner_path):
        story.append(Image(banner_path, width=504, height=90))
        story.append(Spacer(1, 10))

    story.append(Paragraph("HeatWatch 3 Industrial Temperature Telemetry System", title_style))
    story.append(Paragraph("Comprehensive Product Manual, Hardware Architecture, Operations & Troubleshooting Guide", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=primary_color, spaceBefore=0, spaceAfter=12))

    # Meta Info Table
    meta_data = [
        [
            Paragraph("<b>Product Version:</b> v3.0.4", body_style),
            Paragraph("<b>Hardware Target:</b> PPI AIME 8U / Pi 5", body_style),
            Paragraph("<b>Target Host:</b> goosepi (192.168.1.140)", body_style)
        ],
        [
            Paragraph("<b>Document Class:</b> Technical & Operational Manual", body_style),
            Paragraph("<b>OS Compatibility:</b> Linux Bookworm / Raspberry Pi OS", body_style),
            Paragraph("<b>Date:</b> July 2026", body_style)
        ]
    ]
    meta_table = Table(meta_data, colWidths=[168, 168, 168])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f1f5f9")),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('PADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 14))

    # ---------------------------------------------------------
    # 1. EXECUTIVE SYSTEM OVERVIEW & PURPOSE
    # ---------------------------------------------------------
    story.append(Paragraph("1. System Overview & Purpose", heading1_style))
    story.append(Paragraph(
        "<b>HeatWatch 3</b> is an enterprise-grade, real-time industrial temperature telemetry and alarm management solution engineered for 24/7 continuous process monitoring. Interfacing directly with the <b>PPI AIME 8U 8-channel RTD Modbus hardware module</b>, HeatWatch 3 provides ultra-reliable, sub-second temperature acquisition across critical thermal loops including industrial boilers, heat exchangers, chilled water loops, storage tanks, and ambient plant environments.",
        body_style
    ))
    story.append(Paragraph(
        "Built on a resilient microservice architecture, the system combines hardware Modbus polling (`poller.py`), high-throughput InfluxDB time-series logging, Node.js WebSocket broadcasting, and a zero-dependency, touch-optimized HTML5 frontend tailored for 7\" and 10\" Raspberry Pi kiosk displays.",
        body_style
    ))
    story.append(Spacer(1, 8))

    # ---------------------------------------------------------
    # 2. CORE FEATURES & SPECIFICATIONS
    # ---------------------------------------------------------
    story.append(Paragraph("2. Core Product Features", heading1_style))

    features_data = [
        [Paragraph("<b>Feature Feature Category</b>", body_style), Paragraph("<b>Technical Capabilities & Specifications</b>", body_style)],
        [
            Paragraph("<b>8-Channel Real-time Grid</b>", body_style),
            Paragraph("Live telemetry updated every 2 seconds via WebSockets. Includes channel badge, sensor label, progress bar, threshold markers, and dynamic 'Last updated X sec ago' ticker.", body_style)
        ],
        [
            Paragraph("<b>5-Tier Visual Alarm System</b>", body_style),
            Paragraph("• <b>HIHI ALARM / LOLO ALARM:</b> Solid vivid red card fill (<code>#dc2626</code>) with pulsing glow & SCADA chime.<br/>"
                      "• <b>WARNING HI / WARNING LO:</b> Solid bright golden yellow card fill (<code>#eab308</code>) with amber glow.<br/>"
                      "• <b>NORMAL:</b> Clean slate container with green status indicator.<br/>"
                      "• <b>OFFLINE:</b> Grayed-out state for disconnected probes.", body_style)
        ],
        [
            Paragraph("<b>SCADA Audio Siren</b>", body_style),
            Paragraph("Web Audio SCADA dual-tone emergency chime (<code>960Hz</code> &rarr; <code>720Hz</code> & <code>1200Hz</code> &rarr; <code>840Hz</code> chirps) with header mute toggle. Unlocks automatically on user gesture.", body_style)
        ],
        [
            Paragraph("<b>Temperature Unit Conversion</b>", body_style),
            Paragraph("Instant system-wide unit switching between <b>Celsius (&deg;C)</b>, <b>Fahrenheit (&deg;F)</b>, and <b>Kelvin (K)</b> across live cards, trend graphs, 24h stats, and historical export logs.", body_style)
        ],
        [
            Paragraph("<b>Time-Series Trends Chart</b>", body_style),
            Paragraph("Multi-channel Chart.js trend curves supporting 1h, 6h, and 24h historical windows, high-luminance dark mode colors, axis scale autoscale, and tooltip inspection.", body_style)
        ],
        [
            Paragraph("<b>24-Hour Channel Statistics</b>", body_style),
            Paragraph("Min, Avg, and Max daily summary cards calculated dynamically per channel over rolling 24-hour log windows.", body_style)
        ],
        [
            Paragraph("<b>Fullscreen Kiosk & Virtual Keyboard</b>", body_style),
            Paragraph("One-click native fullscreen kiosk toggle and built-in QWERTY/Numpad virtual keyboard for standalone Pi touchscreen administration without external peripherals.", body_style)
        ],
        [
            Paragraph("<b>Branded Data Exports</b>", body_style),
            Paragraph("One-click generation of Goose-branded PDF telemetry reports, formatted Excel workbooks (<code>.xlsx</code>), and raw CSV logs.", body_style)
        ],
        [
            Paragraph("<b>System Health Diagnostics</b>", body_style),
            Paragraph("Monitors Pi CPU Load %, CPU Temp (<code>vcgencmd</code>), RAM usage, NVMe/SD Disk %, InfluxDB size, system uptime, and PPI AIME 8U hardware connection badge.", body_style)
        ]
    ]

    features_table = Table(features_data, colWidths=[140, 364])
    features_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0e7490")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('PADDING', (0,0), (-1,-1), 5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
    ]))
    story.append(features_table)
    story.append(Spacer(1, 14))

    # ---------------------------------------------------------
    # 3. SYSTEM ARCHITECTURE & DATA FLOW
    # ---------------------------------------------------------
    story.append(Paragraph("3. Hardware & Software Architecture", heading1_style))
    story.append(Paragraph(
        "HeatWatch 3 utilizes a decoupled pipeline architecture designed for high availability and data integrity:",
        body_style
    ))

    story.append(Paragraph("• <b>Hardware Layer (PPI AIME 8U):</b> 8 3-wire RTD PT100 sensors connected to the PPI Modbus RTU module at IP <code>192.168.1.2</code> (Port 502 / RS485).", bullet_style))
    story.append(Paragraph("• <b>Ingestion Daemon (`poller.py`):</b> Python background daemon executing Modbus read queries every 2 seconds. Stores valid readings in <b>InfluxDB v2</b> bucket <code>heatwatch_telemetry</code>.", bullet_style))
    story.append(Paragraph("• <b>Web & Application Server (`server.js`):</b> Node.js Express server listening on Port <code>3001</code>. Serves frontend assets, manages REST API endpoints, queries InfluxDB flux data, and broadcasts WebSocket JSON frames.", bullet_style))
    story.append(Paragraph("• <b>Frontend Dashboard (`public/index.html`):</b> Zero-dependency Single Page Application (SPA) utilizing HTML5, Vanilla CSS, Chart.js, and Web Audio API.", bullet_style))

    story.append(Spacer(1, 10))

    # ---------------------------------------------------------
    # 4. STEP-BY-STEP OPERATING GUIDE
    # ---------------------------------------------------------
    story.append(Paragraph("4. Step-by-Step Operating Guide", heading1_style))

    story.append(Paragraph("4.1 Initial Setup Wizard", heading2_style))
    story.append(Paragraph(
        "Upon first system launch, HeatWatch 3 displays an interactive 4-step setup wizard:<br/>"
        "1. <b>Welcome Screen:</b> Overview of PPI AIME 8U integration.<br/>"
        "2. <b>Administrator Account:</b> Set Admin Username, Password, Role, and 4-digit Security Recovery PIN.<br/>"
        "3. <b>RTD Channel Configuration:</b> Define channel names and set threshold limits (LoLo, Lo, Hi, HiHi) for all 8 channels on a zero-scroll table.<br/>"
        "4. <b>Review & Launch:</b> Confirm settings to initialize the telemetry dashboard.",
        body_style
    ))

    story.append(Paragraph("4.2 Live Telemetry Grid & Alarms", heading2_style))
    story.append(Paragraph(
        "The Live view presents 8 channel cards updating in real time. If a sensor temperature breaches set limits:<br/>"
        "• <b>Warning (Hi/Lo):</b> The entire card container pulses in bright golden yellow (<code>#eab308</code>).<br/>"
        "• <b>Alarm (HiHi/LoLo):</b> The entire card pulses in vivid solid red (<code>#dc2626</code>) and triggers the SCADA emergency audio chime.<br/>"
        "• <b>Muting Sound:</b> Click the speaker icon in the top navbar to silence the audio alarm.",
        body_style
    ))

    story.append(Paragraph("4.3 Viewing Trends & Exporting Logs", heading2_style))
    story.append(Paragraph(
        "Navigate to the <b>Trends</b> tab to analyze historical curves and 24-hour channel summary cards. Use the <b>History</b> tab to query past logs by time window (1h/6h/24h/7d) or channel filter, and click <b>PDF</b> or <b>Excel</b> to export reports.",
        body_style
    ))

    story.append(Paragraph("4.4 Settings & Protected Administration", heading2_style))
    story.append(Paragraph(
        "Open the Settings panel (gear icon) to toggle <b>Temperature Units (&deg;C/&deg;F/K)</b> or <b>Hide Offline Channels</b>. Protected settings (editing channel labels or thresholds) require entering your Admin password.",
        body_style
    ))

    story.append(Spacer(1, 14))

    # ---------------------------------------------------------
    # 5. NETWORK & SYSTEM ADMINISTRATION
    # ---------------------------------------------------------
    story.append(Paragraph("5. Network & System Administration", heading1_style))
    story.append(Paragraph(
        "To ensure permanent control room access, HeatWatch 3 includes dedicated network configuration utilities:",
        body_style
    ))

    story.append(Paragraph("5.1 Static IP Setup (`192.168.1.140`)", heading2_style))
    story.append(Paragraph("Lock the Pi IP to `192.168.1.140` using the provided automated script:", body_style))
    story.append(Paragraph("cd ~/Heatwatch-Version-3 && sudo bash scripts/setup-static-ip.sh 192.168.1.140/24 192.168.1.1", code_style))

    story.append(Paragraph("5.2 Local Hostname (mDNS)", heading2_style))
    story.append(Paragraph("With Avahi mDNS enabled, users can connect to the dashboard via <b>`http://heatwatch.local:3001`</b> or <b>`http://goosepi.local:3001`</b> from any device on the local network.", body_style))

    story.append(Paragraph("5.3 Systemd Service Management", heading2_style))
    story.append(Paragraph("The system runs as an auto-starting background service `heatwatch-dashboard.service`:", body_style))
    story.append(Paragraph("# Check Status:\nsudo systemctl status heatwatch-dashboard\n\n# Restart Service:\nsudo systemctl restart heatwatch-dashboard", code_style))

    story.append(Spacer(1, 14))

    # ---------------------------------------------------------
    # 6. COMPREHENSIVE TROUBLESHOOTING GUIDE
    # ---------------------------------------------------------
    story.append(Paragraph("6. Comprehensive Troubleshooting Matrix", heading1_style))

    trouble_data = [
        [Paragraph("<b>Symptom / Issue</b>", body_style), Paragraph("<b>Probable Cause</b>", body_style), Paragraph("<b>Step-by-Step Resolution</b>", body_style)],
        [
            Paragraph("<b>Sensor card displays 0.0 or OFFLINE</b>", body_style),
            Paragraph("1. RTD probe disconnected.<br/>2. PPI hardware offline.<br/>3. Poller daemon stopped.", body_style),
            Paragraph("1. Inspect physical 3-wire RTD probe wiring at PPI terminal block.<br/>2. Check PPI badge in Diagnostics tab.<br/>3. Restart service: <code>sudo systemctl restart heatwatch-dashboard</code>.", body_style)
        ],
        [
            Paragraph("<b>PPI Badge displays 'PPI Offline'</b>", body_style),
            Paragraph("PPI AIME 8U module at IP 192.168.1.2 unreachable or powered off.", body_style),
            Paragraph("1. Verify 24V DC power supply to PPI module.<br/>2. Ping PPI module: <code>ping 192.168.1.2</code>.<br/>3. Check Ethernet/RS485 cable between Pi and PPI.", body_style)
        ],
        [
            Paragraph("<b>Dashboard URL unreachable via Browser</b>", body_style),
            Paragraph("1. Pi IP changed.<br/>2. Node.js server crashed.", body_style),
            Paragraph("1. Verify Pi IP: <code>hostname -I</code>.<br/>2. Re-apply static IP: <code>sudo bash scripts/setup-static-ip.sh 192.168.1.140/24 192.168.1.1</code>.<br/>3. Check logs: <code>journalctl -u heatwatch-dashboard -f</code>.", body_style)
        ],
        [
            Paragraph("<b>Alarm SCADA Audio not playing</b>", body_style),
            Paragraph("1. Browser audio muted.<br/>2. Autoplay policy blocking audio.", body_style),
            Paragraph("1. Check speaker mute button in top navbar.<br/>2. Click anywhere on the browser window to unlock Web Audio API permission.", body_style)
        ],
        [
            Paragraph("<b>Touchscreen Keyboard not appearing</b>", body_style),
            Paragraph("Input focus event lost or touch listener suppressed.", body_style),
            Paragraph("Tap directly into an input field (username/password/threshold) to activate the onscreen QWERTY virtual keyboard.", body_style)
        ],
        [
            Paragraph("<b>InfluxDB Connection / Log Query Error</b>", body_style),
            Paragraph("InfluxDB service inactive or database token expired.", body_style),
            Paragraph("1. Check InfluxDB service: <code>sudo systemctl status influxdb</code>.<br/>2. Restart InfluxDB: <code>sudo systemctl restart influxdb</code>.", body_style)
        ]
    ]

    trouble_table = Table(trouble_data, colWidths=[120, 140, 244])
    trouble_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0f172a")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('PADDING', (0,0), (-1,-1), 5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
    ]))
    story.append(trouble_table)

    # Build PDF Document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"[SUCCESS] HeatWatch 3 Manual created successfully at: {filename}")

if __name__ == "__main__":
    out_pdf = "/Users/suryanarayan/Documents/Projects/Work/HeatWatch3/public/HeatWatch3_Industrial_System_Manual.pdf"
    create_heatwatch_manual(out_pdf)

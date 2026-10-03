import { execFile } from "child_process";
import * as ptp from "pdf-to-printer";

export type ConnectionType =
  | "USB"
  | "Network (TCP/IP)"
  | "Network (WSD)"
  | "Network (Shared)"
  | "Network (IPP)"
  | "Bluetooth"
  | "Parallel (LPT)";

export interface PrinterHardwareInfo {
  name: string;
  isDefault: boolean;
  isPhysical: boolean;
  connectionType: ConnectionType;
  portName: string;
  driverName: string;
  hostAddress: string | null;
  status: "Online" | "Offline" | "Printing" | "Error" | "Unknown";
  isOnline: boolean;
  details: string;
}

const POWERSHELL_DISCOVERY_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'

$defaultPrinterName = (Get-CimInstance Win32_Printer | Where-Object { $_.Default -eq $true } | Select-Object -First 1).Name

$printers = Get-Printer
$ports = Get-PrinterPort
$wmiPrinters = Get-CimInstance Win32_Printer

$knownVirtualDrivers = @(
    "*Microsoft Print To PDF*",
    "*Microsoft XPS Document Writer*",
    "*Microsoft Software Printer Driver*",
    "*Send to Microsoft OneNote*",
    "*Microsoft Shared Fax Driver*",
    "*Adobe PDF*",
    "*CutePDF*",
    "*Foxit*",
    "*Bullzip*",
    "*PrimoPDF*",
    "*doPDF*",
    "*PDFCreator*",
    "*Nitro*",
    "*Generic / Text Only*",
    "*Virtual*",
    "*PDF*"
)

$knownVirtualPorts = @(
    "PORTPROMPT:",
    "FILE:",
    "nul:",
    "null:",
    "SHRFAX:",
    "AD_Port"
)

$results = foreach ($p in $printers) {
    $port = $ports | Where-Object { $_.Name -eq $p.PortName } | Select-Object -First 1
    $wmi = $wmiPrinters | Where-Object { $_.Name -eq $p.Name } | Select-Object -First 1

    $isVirtualDriver = $false
    foreach ($vDriver in $knownVirtualDrivers) {
        if ($p.DriverName -like $vDriver) {
            $isVirtualDriver = $true
            break
        }
    }
    
    $isVirtualPort = $false
    if ($knownVirtualPorts -contains $p.PortName -or $p.PortName -like "*OneNote*" -or $p.PortName -like "*Microsoft.Office*" -or $p.PortName -like "*PDF*") {
        $isVirtualPort = $true
    }

    # Dummy test queues (e.g. mock Point and Print compatibility drivers on COM/dummy ports or PrintSpot)
    $isDummyQueue = $false
    if ($p.Name -like "*PrintSpot*" -or ($p.DriverName -like "*Point and Print compatibility driver*" -and ($p.PortName -like "COM*" -or $p.PortName -like "LPT*"))) {
        $isDummyQueue = $true
    }

    # Exclude virtual queues, print-to-file converters, and dummy queues completely
    if ($isDummyQueue -or $isVirtualPort -or $isVirtualDriver) {
        continue
    }

    $connectionType = "USB"
    $details = "Direct USB connection ($($p.PortName))"

    if ($p.PortName -like "USB*" -or $p.PortName -like "DOT4*") {
        $connectionType = "USB"
        $details = "Direct USB connection ($($p.PortName))"
    }
    elseif ($p.PortName -like "WSD*") {
        $connectionType = "Network (WSD)"
        $details = "Network Plug & Play printer (WSD)"
    }
    elseif ($port.PrinterHostAddress -or $p.PortName -match '^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}' -or $p.PortName -like "IP_*") {
        $connectionType = "Network (TCP/IP)"
        $addr = if ($port.PrinterHostAddress) { $port.PrinterHostAddress } else { $p.PortName }
        $details = "Local Network printer at $addr"
    }
    elseif ($p.PortName -like "http*" -or $p.PortName -like "ipp*") {
        $connectionType = "Network (IPP)"
        $details = "Network IPP print service"
    }
    elseif ($p.Type -eq "Connection" -or $p.Shared) {
        $connectionType = "Network (Shared)"
        $details = "Shared LAN printer queue"
    }
    elseif ($p.PortName -like "BTH*" -or $p.PortName -like "Bluetooth*") {
        $connectionType = "Bluetooth"
        $details = "Wireless Bluetooth connection"
    }
    elseif ($p.PortName -like "LPT*") {
        $connectionType = "Parallel (LPT)"
        $details = "Parallel port connection ($($p.PortName))"
    }
    else {
        $connectionType = "USB"
        $details = "Hardware printer connection ($($p.PortName))"
    }

    $isOnline = $true
    $statusText = "Online"
    if ($wmi) {
        if ($wmi.WorkOffline -or ($wmi.PrinterStatus -eq 7) -or ($wmi.DetectedErrorState -eq 9)) {
            $isOnline = $false
            $statusText = "Offline"
        } elseif ($wmi.PrinterStatus -eq 4) {
            $statusText = "Printing"
        } elseif ($wmi.PrinterStatus -eq 1 -or $wmi.DetectedErrorState -gt 2) {
            $statusText = "Error"
        }
    }

    $isDefault = ($p.Name -eq $defaultPrinterName)

    [PSCustomObject]@{
        name = $p.Name
        isDefault = $isDefault
        isPhysical = $true
        connectionType = $connectionType
        portName = $p.PortName
        driverName = $p.DriverName
        hostAddress = $port.PrinterHostAddress
        status = $statusText
        isOnline = $isOnline
        details = $details
    }
}

if ($results) {
    $results | ConvertTo-Json -Depth 3
} else {
    "[]"
}
`;

/**
 * Discover printers using Windows Management Instrumentation & PowerShell.
 * Discovers and returns exclusively physical hardware machines (USB, Network, WSD, Bluetooth).
 * Virtual software drivers and print-to-file queues are completely excluded.
 */
export async function discoverPrinters(): Promise<PrinterHardwareInfo[]> {
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", POWERSHELL_DISCOVERY_SCRIPT],
      { timeout: 8000 },
      async (err, stdout) => {
        if (!err && stdout && stdout.trim()) {
          try {
            const parsed = JSON.parse(stdout.trim());
            const list: PrinterHardwareInfo[] = (Array.isArray(parsed)
              ? parsed
              : [parsed]
            ).filter((p) => p && p.isPhysical);
            return resolve(list);
          } catch (jsonErr) {
            console.warn(
              "[printer-discovery] JSON parse failed, falling back to basic list:",
              jsonErr
            );
          }
        } else if (err) {
          console.warn("[printer-discovery] PowerShell discovery warning:", err.message);
        }

        // Fallback to basic pdf-to-printer list if PowerShell fails
        try {
          const basicPrinters = await ptp.getPrinters();
          const fallbackList: PrinterHardwareInfo[] = basicPrinters
            .filter((p) => {
              const isVirtual =
                /pdf|xps|onenote|fax|printspot|virtual/i.test(p.name) ||
                /pdf|xps|onenote|fax|virtual/i.test(p.deviceId || "");
              return !isVirtual;
            })
            .map((p) => ({
              name: p.name,
              isDefault: false,
              isPhysical: true,
              connectionType: "USB" as ConnectionType,
              portName: "Unknown",
              driverName: "Unknown",
              hostAddress: null,
              status: "Online",
              isOnline: true,
              details: "Direct hardware connection",
            }));
          resolve(fallbackList);
        } catch (fallbackErr) {
          console.error("[printer-discovery] Complete failure to discover printers:", fallbackErr);
          resolve([]);
        }
      }
    );
  });
}

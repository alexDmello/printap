/// <reference types="vite/client" />

declare module "*.png" {
  const content: string;
  export default content;
}

declare module "*.jpg" {
  const content: string;
  export default content;
}

declare module "*.svg" {
  const content: string;
  export default content;
}

declare module "*.webp" {
  const content: string;
  export default content;
}

interface Window {
  electronAPI?: {
    getNetworkInfo: () => Promise<{
      hostname: string;
      ips: string[];
      platform: string;
    }>;
    getAppVersion: () => Promise<string>;
    archival?: {
      getStatus: () => Promise<{
        activeOrdersCount: number;
        activeEventsCount: number;
        lastArchivedMonth: string | null;
      }>;
      listLocal: () => Promise<Array<{
        monthIdentifier: string;
        cutoffTimestamp: string;
        ordersCount: number;
        eventsCount: number;
        totalAmountInr: number;
        archivePath: string;
        files: string[];
        exportedAt: string;
        purgedFromDb: boolean;
      }>>;
      runExportPurge: (monthIdentifier?: string) => Promise<{
        success: boolean;
        monthIdentifier: string;
        ordersCount: number;
        eventsCount: number;
        totalAmountInr: number;
        archivePath: string;
        message: string;
      }>;
      openFolder: (monthIdentifier?: string) => Promise<boolean>;
      readMonthData: (monthIdentifier: string) => Promise<{
        orders: any[];
        summary: any;
      } | null>;
    };
  };
}

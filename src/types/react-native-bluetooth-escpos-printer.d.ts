declare module 'react-native-bluetooth-escpos-printer' {
  export const BluetoothManager: {
    enableBluetooth(): Promise<any>;
    connect(address: string): Promise<void>;
    disconnect(): Promise<void>;
  };

  export const BluetoothEscposPrinter: {
    ALIGN: {
      LEFT: number;
      CENTER: number;
      RIGHT: number;
    };
    printerAlign(align: number): Promise<void>;
    printText(text: string, options?: any): Promise<void>;
  };
}


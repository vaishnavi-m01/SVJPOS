package com.svjpos;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.util.Set;

public class BluetoothModule extends ReactContextBaseJavaModule {
    private static final String TAG = "BluetoothModule";
    private final ReactApplicationContext reactContext;
    private BluetoothAdapter bluetoothAdapter;
    private final BroadcastReceiver discoveryReceiver;

    public BluetoothModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();

        this.discoveryReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                if (BluetoothDevice.ACTION_FOUND.equals(action)) {
                    BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                    if (device != null) {
                        String deviceName = null;
                        if (intent.hasExtra(BluetoothDevice.EXTRA_NAME)) {
                            deviceName = intent.getStringExtra(BluetoothDevice.EXTRA_NAME);
                        }
                        if (deviceName == null || deviceName.isEmpty()) {
                            deviceName = device.getName();
                        }

                        WritableMap params = Arguments.createMap();
                        params.putString("name", deviceName != null ? deviceName : "Unknown");
                        params.putString("address", device.getAddress());

                        int majorClass = (device.getBluetoothClass() != null)
                                ? device.getBluetoothClass().getMajorDeviceClass()
                                : 7936; // Uncategorized
                        params.putInt("class", majorClass);

                        sendEvent("BluetoothDeviceFound", params);
                    }
                }
            }
        };
    }

    @Override
    public String getName() {
        return "BluetoothModule";
    }

    private void sendEvent(String eventName, WritableMap params) {
        if (reactContext.hasActiveCatalystInstance()) {
            reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit(eventName, params);
        }
    }

    @ReactMethod
    public void enableBluetooth(Promise promise) {
        try {
            if (bluetoothAdapter == null) {
                promise.reject("NO_BLUETOOTH", "Bluetooth adapter not available");
                return;
            }
            if (!bluetoothAdapter.isEnabled()) {
                // We cannot enable programmatically without user action on newer Android,
                // but we can start the intent. However, for a service, we usually just return
                // status.
                // The old lib tried to enable. We'll just request it via Intent if we were an
                // Activity,
                // but here we just return success/fail based on state or assume JS will prompt.
                // Actually, let's just use the adapter's enable() which works on older android,
                // and on newer it might fail or require system privs.
                // Better to guide user to settings or use an Activity Result.
                // For simplicity:
                promise.resolve(false);
            } else {
                promise.resolve(true);
            }
        } catch (Exception e) {
            promise.reject("ENABLE_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void getPairedDevices(Promise promise) {
        try {
            if (bluetoothAdapter == null) {
                promise.reject("NO_BLUETOOTH", "Bluetooth adapter not available");
                return;
            }

            if (Build.VERSION.SDK_INT >= 31) {
                if (reactContext.checkSelfPermission(
                        Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                    // Permission should be requested from JS
                }
            }

            Set<BluetoothDevice> pairedDevices = bluetoothAdapter.getBondedDevices();
            WritableArray deviceList = Arguments.createArray();

            // In getPairedDevices loop
            for (BluetoothDevice device : pairedDevices) {
                WritableMap map = Arguments.createMap();
                String name = device.getName() != null ? device.getName() : "Unknown";
                map.putString("name", name);
                map.putString("address", device.getAddress());

                int majorClass = (device.getBluetoothClass() != null)
                        ? device.getBluetoothClass().getMajorDeviceClass()
                        : 7936; // Uncategorized
                map.putInt("class", majorClass);

                deviceList.pushMap(map);
            }

            promise.resolve(deviceList);
        } catch (SecurityException e) {
            promise.reject("PERMISSION_ERROR", "Bluetooth Connect permission missing: " + e.getMessage());
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void startDiscovery(Promise promise) {
        try {
            if (bluetoothAdapter == null) {
                promise.reject("NO_BLUETOOTH", "Bluetooth adapter not available");
                return;
            }

            // Permissions check is tricky in Native Module without Activity context for
            // requesting,
            // we assume JS checks it.

            // Register receiver
            IntentFilter filter = new IntentFilter(BluetoothDevice.ACTION_FOUND);
            reactContext.registerReceiver(discoveryReceiver, filter);

            boolean started = bluetoothAdapter.startDiscovery();
            promise.resolve(started);
        } catch (SecurityException e) {
            promise.reject("PERMISSION_ERROR", "Bluetooth Scan/Location permission missing");
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void stopDiscovery(Promise promise) {
        try {
            if (bluetoothAdapter != null && bluetoothAdapter.isDiscovering()) {
                bluetoothAdapter.cancelDiscovery();
            }
            try {
                reactContext.unregisterReceiver(discoveryReceiver);
            } catch (IllegalArgumentException e) {
                // Receiver not registered
            }
            promise.resolve(true);
        } catch (SecurityException e) {
            promise.reject("Permission Error", e.getMessage());
        }
    }

    @ReactMethod
    public void pairDevice(String address, Promise promise) {
        try {
            if (bluetoothAdapter == null) {
                promise.reject("NO_BLUETOOTH", "Bluetooth not available");
                return;
            }
            BluetoothDevice device = bluetoothAdapter.getRemoteDevice(address);
            if (device != null) {
                // createBond() requires BLUETOOTH_ADMIN (old) or BLUETOOTH_CONNECT (new)
                boolean result = device.createBond();
                promise.resolve(result);
            } else {
                promise.reject("DEVICE_NOT_FOUND", "Device not found");
            }
        } catch (SecurityException e) {
            promise.reject("PERMISSION_ERROR", e.getMessage());
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void unpairDevice(String address, Promise promise) {
        // Removing bond is via reflection usually, skippping for now as rarely needed
        // for Printers
        promise.resolve(false);
    }
}

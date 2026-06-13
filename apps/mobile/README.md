# mobile — one app, role-switching (farmer/buyer/worker/ambassador)
expo-router in src/app; features/ mirror the 196-screen design catalog
(see ../../Phase-1 all screen design/). core/offline = SQLite cache + sync
queue (villages have 2G). core/voice = STT flows for voice listing.
Design tokens from packages/tokens (generated from the Design System).
Budget devices are the target: <30MB APK, test on 2GB-RAM Androids.

# WEATHER RAGDOLL SIM — Симулятор Катастроф

Симулятор катастроф и погоды от первого лица с реалистичной физикой на Three.js + cannon-es.

## Запуск в браузере
```bash
npm install
npm run dev
# http://localhost:5173
```

## Запуск как EXE (Electron)
```bash
npm install
npm run electron:dev   # dev с хот-релоадом
npm run dist:win       # собрать Windows .exe (требует Windows или wine)
npm run dist           # собрать под текущую ОС
```

Собранные файлы появляются в `release/`:
- `Weather Ragdoll Sim Setup 1.0.0.exe` — установщик
- `Weather-Ragdoll-Sim-1.0.0-portable.exe` — портативный exe без установки

## Сборка EXE на GitHub
Пуш в `main` автоматически запускает сборку Windows EXE через GitHub Actions.
Скачай артефакт `Weather-Ragdoll-Sim-Windows` в разделе Actions.

## Управление
WASD — движение, Мышь — обзор, Shift — бег, Пробел — прыжок, C — присесть

## Катастрофы
Ясно, Ливень, Гроза, Торнадо, Ураган, Потоп, Землетрясение, Буран
Горячие клавиши: T/G/F/E

## Фикс камеры
Крен камеры (качка налево-направо) полностью отключён — горизонт зафиксирован.

---
id: ASSUMP-0001
title: Single active recording session per API process
status: accepted
date: 2026-08-02
---

# ASSUMP-0001

El `RecorderService` admite **una** sesión activa (`activeSessionId`) por proceso Node.  
Multi-sesión concurrente requiere ADR nuevo + diseño de isolation de browsers.

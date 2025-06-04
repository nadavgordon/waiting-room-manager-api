#!/bin/bash
yq '.task_execution.major_steps[] | select(.status == "Pending") | [.step_id, .description, .status] | join(" | ")' /run/media/nadavg/spinner/Projects/waiting-room-manager-api/plan/agendas/comprehensive-waiting-room-audit-agenda.mdml.yml > /run/media/nadavg/spinner/Projects/waiting-room-manager-api/pending_tasks.txt

# Also extract partially completed tasks
yq '.task_execution.major_steps[] | select(.status == "Partially Completed") | [.step_id, .description, .status] | join(" | ")' /run/media/nadavg/spinner/Projects/waiting-room-manager-api/plan/agendas/comprehensive-waiting-room-audit-agenda.mdml.yml >> /run/media/nadavg/spinner/Projects/waiting-room-manager-api/pending_tasks.txt

# Extract all sub-steps that are pending
yq '.task_execution.major_steps[].sub_steps[] | select(.status == "Pending") | ["  - Sub-step", .description, .status] | join(" | ")' /run/media/nadavg/spinner/Projects/waiting-room-manager-api/plan/agendas/comprehensive-waiting-room-audit-agenda.mdml.yml >> /run/media/nadavg/spinner/Projects/waiting-room-manager-api/pending_tasks.txt

chmod +x /run/media/nadavg/spinner/Projects/waiting-room-manager-api/temp_script.sh
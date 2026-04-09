import crypto from 'node:crypto';
import {
  approvePayrollBatch,
  createPayrollBatch,
  getPayrollBatchDetail,
} from '../finance/financeEntries.service.mjs';

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const raw = typeof value === 'object' && typeof value.toString === 'function' ? value.toString() : value;
  const out = Number(raw);
  return Number.isFinite(out) ? out : 0;
}

function toDateOnly(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfMonthUtc(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonthUtc(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function countWorkingWeekdays(start, end) {
  let count = 0;
  const cursor = toDateOnly(start);
  const stop = toDateOnly(end);
  while (cursor.getTime() <= stop.getTime()) {
    const day = cursor.getUTCDay();
    if (day >= 1 && day <= 5) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

function computeNextRun(rule, dayOfMonth, fromDate = new Date()) {
  const base = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()));
  const monthStart = startOfMonthUtc(base);
  const monthEnd = endOfMonthUtc(base);

  if (rule === 'last_working_day') {
    const probe = new Date(monthEnd);
    while (probe.getUTCDay() === 0 || probe.getUTCDay() === 6) {
      probe.setUTCDate(probe.getUTCDate() - 1);
    }
    if (probe.getTime() > base.getTime()) return probe;
    const nextMonthEnd = endOfMonthUtc(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1)));
    const nextProbe = new Date(nextMonthEnd);
    while (nextProbe.getUTCDay() === 0 || nextProbe.getUTCDay() === 6) {
      nextProbe.setUTCDate(nextProbe.getUTCDate() - 1);
    }
    return nextProbe;
  }

  const day = Math.min(Math.max(Number(dayOfMonth || 25), 1), 31);
  const thisMonthTarget = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), Math.min(day, monthEnd.getUTCDate())));
  if (thisMonthTarget.getTime() > base.getTime()) return thisMonthTarget;

  const nextMonthStart = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1));
  const nextMonthEnd = endOfMonthUtc(nextMonthStart);
  return new Date(Date.UTC(nextMonthStart.getUTCFullYear(), nextMonthStart.getUTCMonth(), Math.min(day, nextMonthEnd.getUTCDate())));
}

function buildCode(prefix) {
  return `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

async function writeAuditLog(tx, payload) {
  return tx.auditLog.create({
    data: {
      txId: payload.txId || crypto.randomUUID(),
      occurredAt: new Date(),
      userId: payload.userId || null,
      module: 'finance',
      entity: payload.entity,
      entityId: payload.entityId,
      actionType: payload.actionType,
      oldValueJson: payload.oldValueJson ?? null,
      newValueJson: payload.newValueJson ?? null,
      metaJson: payload.metaJson ?? null,
    },
  });
}

async function logRun(tx, payrollRunId, actionType, message, detailJson, actor) {
  await tx.payrollRunLog.create({
    data: {
      payrollRunId,
      actorUserId: actor?.actorUserId || null,
      actorDisplayName: actor?.actorDisplayName || null,
      actionType,
      message,
      detailJson: detailJson || null,
      level: actionType.includes('error') ? 'error' : 'info',
    },
  });
}

async function notifyRun(tx, payrollRunId, type, title, message, severity = 'info', recipientRole = null) {
  await tx.payrollNotification.create({
    data: {
      payrollRunId,
      notificationType: type,
      severity,
      recipientRole,
      title,
      message,
      status: 'sent',
    },
  });
}

async function resolveSalaryProfiles(prisma, users, periodStart, periodEnd) {
  if (!users.length) return new Map();
  const profiles = await prisma.employeeSalaryProfile.findMany({
    where: {
      userId: { in: users.map((u) => u.id) },
      isActive: true,
      effectiveFrom: { lte: periodEnd },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodStart } }],
    },
    orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
  });

  const map = new Map();
  for (const profile of profiles) {
    if (!map.has(profile.userId)) map.set(profile.userId, profile);
  }
  return map;
}

function determinePeriod(input) {
  if (input?.periodStart && input?.periodEnd) {
    return {
      periodStart: new Date(input.periodStart),
      periodEnd: new Date(input.periodEnd),
    };
  }
  const now = new Date();
  return {
    periodStart: startOfMonthUtc(now),
    periodEnd: endOfMonthUtc(now),
  };
}

function monthCode(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function listPayrollSchedules(prisma) {
  return prisma.payrollSchedule.findMany({
    where: { isActive: true },
    include: {
      history: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listEmployeeSalaryProfiles(prisma, filters = {}) {
  const where = {
    isActive: filters.isActive === undefined ? true : Boolean(filters.isActive),
  };
  if (filters.userId) where.userId = String(filters.userId);

  return prisma.employeeSalaryProfile.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          departmentId: true,
          isActive: true,
          isDeleted: true,
        },
      },
    },
    orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    take: filters.take ? Number(filters.take) : 500,
  });
}

export async function upsertEmployeeSalaryProfile(prisma, payload, actor) {
  const userId = String(payload.userId || '').trim();
  if (!userId) throw new Error('userId is required.');
  const monthlyBaseSalary = toNumber(payload.monthlyBaseSalary);
  if (monthlyBaseSalary <= 0) throw new Error('monthlyBaseSalary must be greater than zero.');
  const overtimeMultiplier = toNumber(payload.overtimeMultiplier || 1.5);
  if (overtimeMultiplier <= 0) throw new Error('overtimeMultiplier must be greater than zero.');
  const effectiveFrom = payload.effectiveFrom ? new Date(payload.effectiveFrom) : new Date();
  const effectiveTo = payload.effectiveTo ? new Date(payload.effectiveTo) : null;

  return prisma.$transaction(async (tx) => {
    const existing = payload.id ? await tx.employeeSalaryProfile.findUnique({ where: { id: String(payload.id) } }) : null;
    const saved = existing
      ? await tx.employeeSalaryProfile.update({
          where: { id: existing.id },
          data: {
            monthlyBaseSalary,
            currencyCode: payload.currencyCode || existing.currencyCode || 'USD',
            overtimeMultiplier,
            effectiveFrom,
            effectiveTo,
            isActive: payload.isActive === undefined ? existing.isActive : Boolean(payload.isActive),
          },
        })
      : await tx.employeeSalaryProfile.create({
          data: {
            userId,
            monthlyBaseSalary,
            currencyCode: payload.currencyCode || 'USD',
            overtimeMultiplier,
            effectiveFrom,
            effectiveTo,
            isActive: payload.isActive === undefined ? true : Boolean(payload.isActive),
            createdByUserId: actor?.actorUserId || null,
            createdByName: actor?.actorDisplayName || null,
          },
        });

    await writeAuditLog(tx, {
      userId: actor?.actorUserId || null,
      entity: 'employee_salary_profile',
      entityId: saved.id,
      actionType: existing ? 'updated' : 'created',
      oldValueJson: existing || null,
      newValueJson: saved,
      metaJson: { userId },
    });

    return saved;
  });
}

export async function upsertPayrollSchedule(prisma, payload, actor) {
  const executionRule = payload.executionRule === 'last_working_day' ? 'last_working_day' : 'day_of_month';
  const dayOfMonth = executionRule === 'day_of_month' ? Math.min(Math.max(Number(payload.dayOfMonth || 25), 1), 31) : null;
  const nextRunAt = computeNextRun(executionRule, dayOfMonth, new Date());

  return prisma.$transaction(async (tx) => {
    const existing = payload.id
      ? await tx.payrollSchedule.findUnique({ where: { id: String(payload.id) } })
      : await tx.payrollSchedule.findFirst({ where: { code: String(payload.code || '').trim() || 'default' } });

    const saved = existing
      ? await tx.payrollSchedule.update({
          where: { id: existing.id },
          data: {
            name: payload.name || existing.name,
            executionRule,
            dayOfMonth,
            timezone: payload.timezone || existing.timezone || 'UTC',
            validationMode: payload.validationMode || existing.validationMode || 'review_before_posting',
            isActive: payload.isActive === undefined ? true : Boolean(payload.isActive),
            nextRunAt,
          },
        })
      : await tx.payrollSchedule.create({
          data: {
            code: String(payload.code || 'default').trim() || 'default',
            name: String(payload.name || 'Default Monthly Payroll').trim(),
            executionRule,
            dayOfMonth,
            timezone: payload.timezone || 'UTC',
            validationMode: payload.validationMode || 'review_before_posting',
            isActive: payload.isActive === undefined ? true : Boolean(payload.isActive),
            nextRunAt,
            createdByUserId: actor?.actorUserId || null,
            createdByName: actor?.actorDisplayName || null,
          },
        });

    await tx.payrollScheduleHistory.create({
      data: {
        payrollScheduleId: saved.id,
        changedByUserId: actor?.actorUserId || null,
        changedByName: actor?.actorDisplayName || null,
        changeType: existing ? 'updated' : 'created',
        oldValueJson: existing || null,
        newValueJson: saved,
      },
    });

    await writeAuditLog(tx, {
      userId: actor?.actorUserId || null,
      entity: 'payroll_schedule',
      entityId: saved.id,
      actionType: existing ? 'updated' : 'created',
      oldValueJson: existing || null,
      newValueJson: saved,
      metaJson: { module: 'hrm-finance-payroll' },
    });

    return saved;
  });
}

export async function listPayrollRuns(prisma, filters = {}) {
  const where = {};
  if (filters.status) where.status = String(filters.status);
  if (filters.postingStatus) where.postingStatus = String(filters.postingStatus);

  return prisma.payrollRun.findMany({
    where,
    include: {
      payrollSchedule: true,
      payrollPeriod: true,
      payrollBatch: true,
      notifications: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
    orderBy: { createdAt: 'desc' },
    take: filters.take ? Number(filters.take) : 50,
  });
}

export async function getPayrollRunDetail(prisma, payrollRunId) {
  return prisma.payrollRun.findUnique({
    where: { id: payrollRunId },
    include: {
      payrollSchedule: true,
      payrollPeriod: true,
      payrollBatch: {
        include: {
          lines: { orderBy: { createdAt: 'asc' } },
        },
      },
      employees: { orderBy: { createdAt: 'asc' } },
      notifications: { orderBy: { createdAt: 'desc' } },
      logs: { orderBy: { createdAt: 'desc' }, take: 200 },
    },
  });
}

export async function executePayrollRun(prisma, payload, actor) {
  const schedule = payload.scheduleId
    ? await prisma.payrollSchedule.findUnique({ where: { id: String(payload.scheduleId) } })
    : await prisma.payrollSchedule.findFirst({ where: { isActive: true }, orderBy: { updatedAt: 'desc' } });

  const derivedPeriod = determinePeriod(payload);
  const periodStart = toDateOnly(derivedPeriod.periodStart);
  const periodEnd = toDateOnly(derivedPeriod.periodEnd);

  const validationMode = payload.validationMode || schedule?.validationMode || 'review_before_posting';
  const triggerType = payload.triggerType || (schedule ? 'scheduled' : 'manual');
  const computed = await prisma.$transaction(async (tx) => {
    const periodCode = monthCode(periodStart);
    const payrollPeriod = await tx.payrollPeriod.upsert({
      where: { code: periodCode },
      update: {
        periodStart,
        periodEnd,
      },
      create: {
        code: periodCode,
        periodStart,
        periodEnd,
        month: periodStart.getUTCMonth() + 1,
        year: periodStart.getUTCFullYear(),
      },
    });

    const run = await tx.payrollRun.create({
      data: {
        runCode: buildCode('PRUN'),
        payrollScheduleId: schedule?.id || null,
        payrollPeriodId: payrollPeriod.id,
        triggerType,
        validationMode,
        postingStatus: validationMode === 'automatic_posting' ? 'auto_posting' : 'pending_validation',
        status: 'running',
        startedByUserId: actor?.actorUserId || null,
        startedByName: actor?.actorDisplayName || 'System',
      },
    });

    await logRun(tx, run.id, 'run_started', 'Payroll run started.', {
      periodStart,
      periodEnd,
      validationMode,
      triggerType,
    }, actor);

    const users = await tx.user.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        hasSystemAccess: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        departmentId: true,
        createdAt: true,
      },
    });

    const salaryByUser = await resolveSalaryProfiles(tx, users, periodStart, periodEnd);
    const approvedEntries = await tx.timesheetEntry.findMany({
      where: {
        isDeleted: false,
        statusCode: 'approved',
        workDate: {
          gte: periodStart,
          lte: periodEnd,
        },
        userId: { in: users.map((u) => u.id) },
      },
      orderBy: { workDate: 'asc' },
    });

    const entriesByUser = new Map();
    for (const row of approvedEntries) {
      const list = entriesByUser.get(row.userId) || [];
      list.push(row);
      entriesByUser.set(row.userId, list);
    }

    const standardWorkingDays = countWorkingWeekdays(periodStart, periodEnd);
    const employeeLines = [];
    let warnings = 0;
    let errors = 0;
    let included = 0;
    let excluded = 0;
    let blocked = 0;

    for (const user of users) {
      const salary = salaryByUser.get(user.id);
      const entries = entriesByUser.get(user.id) || [];

      if (!salary) {
        excluded += 1;
        warnings += 1;
        const row = await tx.payrollRunEmployee.create({
          data: {
            payrollRunId: run.id,
            userId: user.id,
            departmentId: user.departmentId || null,
            inclusionStatus: 'excluded',
            exclusionReason: 'missing_salary_profile',
            warningJson: ['Missing active salary profile.'],
            errorJson: null,
          },
        });
        await logRun(tx, run.id, 'employee_excluded', `Employee excluded: ${user.name || user.email || user.id} (missing salary profile).`, { userId: user.id }, actor);
        employeeLines.push(row);
        continue;
      }

      const activeStart = user.createdAt && user.createdAt > periodStart ? toDateOnly(user.createdAt) : periodStart;
      const filtered = entries.filter((item) => {
        const wd = toDateOnly(new Date(item.workDate));
        return wd.getTime() >= activeStart.getTime() && wd.getTime() <= periodEnd.getTime();
      });

      if (!filtered.length) {
        blocked += 1;
        warnings += 1;
        const row = await tx.payrollRunEmployee.create({
          data: {
            payrollRunId: run.id,
            userId: user.id,
            departmentId: user.departmentId || null,
            salaryProfileId: salary.id,
            inclusionStatus: 'blocked_missing_timesheet',
            exclusionReason: 'missing_approved_timesheet',
            standardWorkingDays,
            warningJson: ['No approved timesheet entries in payroll period.'],
          },
        });
        await logRun(tx, run.id, 'employee_blocked', `Employee blocked: ${user.name || user.email || user.id} (no approved timesheet).`, { userId: user.id }, actor);
        employeeLines.push(row);
        continue;
      }

      const distinctByDay = new Map();
      for (const item of filtered) {
        const d = toDateOnly(new Date(item.workDate)).toISOString().slice(0, 10);
        if (!distinctByDay.has(d)) distinctByDay.set(d, []);
        distinctByDay.get(d).push(item);
      }

      let regularWorkedDays = 0;
      let weekendWorkedDays = 0;
      const timesheetIds = [];

      for (const [dayKey, rows] of distinctByDay.entries()) {
        const day = new Date(`${dayKey}T00:00:00.000Z`);
        const weekDay = day.getUTCDay();
        rows.forEach((r) => timesheetIds.push(r.id));
        if (weekDay === 0 || weekDay === 6) weekendWorkedDays += 1;
        else regularWorkedDays += 1;
      }

      const monthlyBaseSalary = toNumber(salary.monthlyBaseSalary);
      const dailyRate = standardWorkingDays > 0 ? monthlyBaseSalary / standardWorkingDays : 0;
      const overtimeMultiplier = toNumber(salary.overtimeMultiplier || 1.5);
      const regularPay = dailyRate * regularWorkedDays;
      const overtimePay = dailyRate * overtimeMultiplier * weekendWorkedDays;
      const grossPay = regularPay + overtimePay;

      if (!Number.isFinite(grossPay) || grossPay < 0) {
        errors += 1;
        const row = await tx.payrollRunEmployee.create({
          data: {
            payrollRunId: run.id,
            userId: user.id,
            departmentId: user.departmentId || null,
            salaryProfileId: salary.id,
            inclusionStatus: 'error',
            exclusionReason: 'invalid_calculation',
            errorJson: ['Invalid payroll calculation output.'],
          },
        });
        await logRun(tx, run.id, 'employee_error', `Payroll calculation failed for ${user.name || user.email || user.id}.`, { userId: user.id }, actor);
        employeeLines.push(row);
        continue;
      }

      included += 1;
      const line = await tx.payrollRunEmployee.create({
        data: {
          payrollRunId: run.id,
          userId: user.id,
          departmentId: user.departmentId || null,
          salaryProfileId: salary.id,
          inclusionStatus: 'included',
          regularWorkedDays,
          weekendWorkedDays,
          standardWorkingDays,
          dailyRate,
          overtimeMultiplier,
          regularPay,
          overtimePay,
          grossPay,
        },
      });

      await tx.payrollCalculationDetail.create({
        data: {
          payrollRunId: run.id,
          payrollRunEmployeeId: line.id,
          ruleCode: 'timesheet_daily_rate_v1',
          ruleDescription: 'Daily rate from monthly salary and Monday-Friday working days, with weekend overtime multiplier.',
          inputJson: {
            monthlyBaseSalary,
            standardWorkingDays,
            regularWorkedDays,
            weekendWorkedDays,
            overtimeMultiplier,
          },
          outputJson: {
            dailyRate,
            regularPay,
            overtimePay,
            grossPay,
          },
        },
      });

      for (const tsId of timesheetIds) {
        const ts = filtered.find((f) => f.id === tsId);
        if (!ts) continue;
        const d = toDateOnly(new Date(ts.workDate));
        const wd = d.getUTCDay();
        await tx.payrollRunTimesheetLink.create({
          data: {
            payrollRunId: run.id,
            payrollRunEmployeeId: line.id,
            timesheetEntryId: ts.id,
            workedDate: d,
            weekdayType: wd === 0 || wd === 6 ? 'weekend' : 'weekday',
            hours: ts.hours,
          },
        });
      }

      employeeLines.push(line);
    }

    const includable = employeeLines.filter((line) => line.inclusionStatus === 'included');
    const totalRegularPay = includable.reduce((sum, line) => sum + toNumber(line.regularPay), 0);
    const totalOvertimePay = includable.reduce((sum, line) => sum + toNumber(line.overtimePay), 0);
    const totalGrossPay = includable.reduce((sum, line) => sum + toNumber(line.adjustedGrossPay ?? line.grossPay), 0);

    const nextRunAt = schedule ? computeNextRun(schedule.executionRule, schedule.dayOfMonth, new Date()) : null;

    const updatedRun = await tx.payrollRun.update({
      where: { id: run.id },
      data: {
        completedAt: new Date(),
        status: errors > 0 ? 'completed_with_errors' : 'completed',
        postingStatus: includable.length === 0 ? 'blocked' : 'pending_batch_generation',
        postingCompletedAt: null,
        totalEmployees: users.length,
        includedEmployees: included,
        excludedEmployees: excluded,
        blockedEmployees: blocked,
        warningCount: warnings,
        errorCount: errors,
        totalRegularPay,
        totalOvertimePay,
        totalGrossPay,
      },
    });

    if (schedule) {
      await tx.payrollSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: new Date(),
          lastRunStatus: updatedRun.status,
          nextRunAt,
        },
      });
    }

    await notifyRun(
      tx,
      run.id,
      'payroll_processed',
      'Payroll run completed',
      `Run ${run.runCode} completed. Included=${included}, Excluded=${excluded}, Blocked=${blocked}.`,
      errors > 0 ? 'warning' : 'info',
      'finance',
    );

    if (blocked > 0) {
      await notifyRun(
        tx,
        run.id,
        'timesheet_missing',
        'Employees blocked by missing approved timesheets',
        `${blocked} employees were blocked due to missing/unapproved timesheets for the period.`,
        'warning',
        'hr',
      );
    }

    await logRun(tx, run.id, 'run_completed', 'Payroll run completed.', {
      included,
      excluded,
      blocked,
      warnings,
      errors,
      totalGrossPay,
      payrollBatchId: null,
    }, actor);

    await writeAuditLog(tx, {
      userId: actor?.actorUserId || null,
      entity: 'payroll_run',
      entityId: run.id,
      actionType: 'executed',
      oldValueJson: null,
      newValueJson: updatedRun,
      metaJson: {
        included,
        excluded,
        blocked,
      },
    });
    return {
      runId: run.id,
      runCode: run.runCode,
      periodStart,
      periodEnd,
      includable: includable.map((line) => {
        const user = users.find((u) => u.id === line.userId);
        return {
          payrollRunEmployeeId: line.id,
          userId: line.userId,
          employeeCode: line.userId.slice(-8).toUpperCase(),
          employeeName: user?.name || user?.email || line.userId,
          regularPay: toNumber(line.regularPay),
          overtimePay: toNumber(line.overtimePay),
          grossPay: toNumber(line.adjustedGrossPay ?? line.grossPay),
        };
      }),
    };
  });

  if (computed.includable.length > 0) {
    const batch = await createPayrollBatch(prisma, {
      batchCode: buildCode('PAYROLL'),
      periodStart: computed.periodStart,
      periodEnd: computed.periodEnd,
      payoutDate: payload.payoutDate || null,
      currencyCode: payload.currencyCode || 'USD',
      notes: `Auto-generated from payroll run ${computed.runCode}`,
      actorUserId: actor?.actorUserId || null,
      actorDisplayName: actor?.actorDisplayName || 'System',
      lines: computed.includable.map((row) => ({
        employeeUserId: row.userId,
        employeeCode: row.employeeCode,
        employeeName: row.employeeName,
        netAmount: row.grossPay,
        totalAmount: row.grossPay,
        notes: `Regular=${row.regularPay} Overtime=${row.overtimePay}`,
      })),
    });

    await prisma.$transaction(async (tx) => {
      const lineByEmployeeUserId = new Map((batch.lines || []).map((line) => [line.employeeUserId, line]));
      for (const row of computed.includable) {
        const payrollLine = lineByEmployeeUserId.get(row.userId);
        if (!payrollLine) continue;
        await tx.payrollRunEmployee.update({
          where: { id: row.payrollRunEmployeeId },
          data: {
            payrollLineId: payrollLine.id,
            payableId: payrollLine.payableId || null,
          },
        });
      }

      await tx.payrollRun.update({
        where: { id: computed.runId },
        data: {
          payrollBatchId: batch.id,
          postingStatus: validationMode === 'automatic_posting' ? 'auto_posting' : 'pending_validation',
        },
      });

      await logRun(tx, computed.runId, 'batch_generated', `Payroll batch ${batch.batchCode} generated.`, { payrollBatchId: batch.id }, actor);
    });

    if (validationMode === 'automatic_posting') {
      await postPayrollRun(prisma, computed.runId, {
        registerProofReference: `AUTO-REGISTER-${Date.now()}`,
        notes: 'Auto-approved by payroll schedule configuration.',
      }, actor || { actorDisplayName: 'System', actorUserId: null });
    }
  }

  return getPayrollRunDetail(prisma, computed.runId);
}

export async function runDuePayrollSchedules(prisma, actor) {
  const now = new Date();
  const dueSchedules = await prisma.payrollSchedule.findMany({
    where: {
      isActive: true,
      nextRunAt: { lte: now },
    },
    orderBy: { nextRunAt: 'asc' },
    take: 10,
  });

  const runs = [];
  for (const schedule of dueSchedules) {
    const run = await executePayrollRun(prisma, {
      scheduleId: schedule.id,
      triggerType: 'scheduled',
      validationMode: schedule.validationMode,
    }, actor || { actorDisplayName: 'System Scheduler', actorUserId: null });
    runs.push(run);
  }
  return runs;
}

export async function postPayrollRun(prisma, payrollRunId, payload, actor) {
  return prisma.$transaction(async (tx) => {
    const run = await tx.payrollRun.findUnique({ where: { id: payrollRunId } });
    if (!run) throw new Error('Payroll run not found.');
    if (!run.payrollBatchId) throw new Error('Payroll run has no linked payroll batch.');

    await approvePayrollBatch(tx, run.payrollBatchId, {
      registerProofReference: payload.registerProofReference || `REGISTER-${Date.now()}`,
      actorUserId: actor?.actorUserId || null,
      actorDisplayName: actor?.actorDisplayName || 'Finance Approver',
      notes: payload.notes || `Approved from payroll run ${run.runCode}`,
    });

    const updated = await tx.payrollRun.update({
      where: { id: payrollRunId },
      data: {
        postingStatus: 'posted',
        postingCompletedAt: new Date(),
      },
    });

    await logRun(tx, payrollRunId, 'run_posted', 'Payroll run posted to finance.', { payrollBatchId: run.payrollBatchId }, actor);
    await notifyRun(tx, payrollRunId, 'manual_validation_completed', 'Payroll posted', `Payroll run ${run.runCode} was validated and posted.`, 'info', 'finance');

    return { run: updated, batch: await getPayrollBatchDetail(tx, run.payrollBatchId) };
  });
}

export async function adjustPayrollRunEmployee(prisma, payrollRunEmployeeId, payload, actor) {
  const adjustedAmount = toNumber(payload.adjustedAmount);
  if (!Number.isFinite(adjustedAmount) || adjustedAmount < 0) throw new Error('Invalid adjusted amount.');
  if (!payload.reason || String(payload.reason).trim().length < 3) throw new Error('Adjustment reason is required.');

  return prisma.$transaction(async (tx) => {
    const row = await tx.payrollRunEmployee.findUnique({ where: { id: payrollRunEmployeeId } });
    if (!row) throw new Error('Payroll run employee line not found.');

    const run = await tx.payrollRun.findUnique({ where: { id: row.payrollRunId } });
    if (!run) throw new Error('Payroll run not found.');
    if (run.postingStatus === 'posted') throw new Error('Cannot adjust after posting.');

    const originalAmount = toNumber(row.adjustedGrossPay ?? row.grossPay);
    await tx.payrollAdjustment.create({
      data: {
        payrollRunId: row.payrollRunId,
        payrollRunEmployeeId: row.id,
        originalAmount,
        adjustedAmount,
        reason: String(payload.reason).trim(),
        comment: payload.comment || null,
        adjustedByUserId: actor?.actorUserId || null,
        adjustedByName: actor?.actorDisplayName || null,
      },
    });

    const updatedRow = await tx.payrollRunEmployee.update({
      where: { id: row.id },
      data: {
        adjustedGrossPay: adjustedAmount,
      },
    });

    if (row.payrollLineId) {
      const payrollLine = await tx.payrollDisbursementLine.update({
        where: { id: row.payrollLineId },
        data: {
          netAmount: adjustedAmount,
          totalAmount: adjustedAmount,
          notes: payload.comment || `Adjusted from ${originalAmount} to ${adjustedAmount}`,
        },
      });

      if (payrollLine.payableId) {
        const payable = await tx.payable.findUnique({ where: { id: payrollLine.payableId } });
        if (payable) {
          await tx.payable.update({
            where: { id: payable.id },
            data: {
              totalAmount: adjustedAmount,
              outstandingAmount: Math.max(adjustedAmount - toNumber(payable.paidAmount), 0),
            },
          });
          await tx.financeEntry.update({
            where: { id: payable.financeEntryId },
            data: {
              amount: adjustedAmount,
              memo: payload.comment || `Adjusted via payroll run ${run.runCode}`,
            },
          });
        }
      }
    }

    const allLines = await tx.payrollRunEmployee.findMany({ where: { payrollRunId: row.payrollRunId } });
    const totalGrossPay = allLines
      .filter((line) => line.inclusionStatus === 'included')
      .reduce((sum, line) => sum + toNumber(line.id === updatedRow.id ? adjustedAmount : (line.adjustedGrossPay ?? line.grossPay)), 0);

    await tx.payrollRun.update({
      where: { id: row.payrollRunId },
      data: {
        totalGrossPay,
      },
    });

    await logRun(tx, row.payrollRunId, 'manual_override', `Manual payroll override for employee line ${row.id}.`, {
      originalAmount,
      adjustedAmount,
      reason: payload.reason,
      comment: payload.comment || null,
    }, actor);

    await writeAuditLog(tx, {
      userId: actor?.actorUserId || null,
      entity: 'payroll_adjustment',
      entityId: row.id,
      actionType: 'adjusted',
      oldValueJson: { amount: originalAmount },
      newValueJson: { amount: adjustedAmount },
      metaJson: {
        payrollRunId: row.payrollRunId,
        reason: payload.reason,
        comment: payload.comment || null,
      },
    });

    return tx.payrollRunEmployee.findUnique({ where: { id: row.id } });
  });
}

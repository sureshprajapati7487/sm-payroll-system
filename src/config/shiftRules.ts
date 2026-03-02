import { ShiftType } from '@/types';

type ShiftRule = { startTime: string; endTime: string; graceTimeMinutes: number; halfDayThresholdHours: number; };

export const DEFAULT_SHIFT_RULES: Record<ShiftType, ShiftRule> = {
    MORNING: {
        startTime: '08:00',
        endTime: '17:00',
        graceTimeMinutes: 15,
        halfDayThresholdHours: 4,
    },
    GENERAL: {
        startTime: '09:00',
        endTime: '18:00',
        graceTimeMinutes: 15,
        halfDayThresholdHours: 4,
    },
    EVENING: {
        startTime: '14:00',
        endTime: '23:00',
        graceTimeMinutes: 15,
        halfDayThresholdHours: 4,
    },
    NIGHT: {
        startTime: '22:00',
        endTime: '07:00',
        graceTimeMinutes: 15,
        halfDayThresholdHours: 4,
    },
};

export const calculateLateDuration = (checkInTime: Date, shiftStart: string, graceMinutes: number): number => {
    const [startHour, startMinute] = shiftStart.split(':').map(Number);

    const shiftStartTime = new Date(checkInTime);
    shiftStartTime.setHours(startHour, startMinute, 0, 0);

    const graceTimeEnd = new Date(shiftStartTime.getTime() + graceMinutes * 60000);

    if (checkInTime > graceTimeEnd) {
        const diffMs = checkInTime.getTime() - shiftStartTime.getTime();
        return Math.floor(diffMs / 60000); // Minutes late
    }

    return 0; // On time
};

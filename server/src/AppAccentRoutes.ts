import type { Request, Response } from 'express';
import execQuery from './execQuery';
import { authenticatedUserId } from './requestAuth';

export async function saveAppAccentColor(req: Request, res: Response): Promise<void> {
    const userId = authenticatedUserId(req);
    if (!userId) {
        res.status(401).json({ message: 'Please sign in again to save your color.' });
        return;
    }
    const { mode, color } = req.body ?? {};
    if ((mode !== 'light' && mode !== 'dark') || typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) {
        res.status(400).json({ message: 'Choose a valid light or dark accent color.' });
        return;
    }
    const [r, g, b] = color.slice(1).match(/../g)!.map(channel => parseInt(channel, 16) / 255)
        .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
    const contrast = mode === 'light' ? 1.05 / (luminance + 0.05) : (luminance + 0.05) / 0.05;
    if (contrast < 4.5) {
        res.status(400).json({ message: 'This color does not provide readable text in that mode.' });
        return;
    }
    try {
        // Column names are fixed by the validated mode; identity comes from the cookie.
        const column = mode === 'light' ? 'color1' : 'color2';
        await execQuery(`UPDATE members SET ${column} = ? WHERE id = ?`, [color.toUpperCase(), userId]);
        res.status(200).json({ mode, color: color.toUpperCase() });
    } catch (error) {
        console.error('Unable to save accent color:', error);
        res.status(500).json({ message: 'Your color could not be saved. Please try again.' });
    }
}

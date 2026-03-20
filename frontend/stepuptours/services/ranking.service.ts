// services/ranking.service.ts
// Servicio de ranking — agnóstico del backend

import axios from 'axios';
import type { RankingEntry } from '../types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://stepuptours.ddev.site';

export async function getRanking(): Promise<RankingEntry[]> {
  const { data } = await axios.get(`${BASE_URL}/api/ranking`);
  // The endpoint returns an array of objects with: position, userId, username, publicName, avatar, toursCompleted, totalXp
  return (data ?? []).map((item: any, index: number) => ({
    position: item.position ?? index + 1,
    userId: item.userId ?? '',
    username: item.username ?? '',
    publicName: item.publicName ?? item.username ?? '',
    avatar: item.avatar ?? null,
    countryCode: item.countryCode ?? null,
    toursCompleted: item.toursCompleted ?? item.tours_completed ?? 0,
    totalXp: item.totalXp ?? item.total_xp ?? 0,
  }));
}

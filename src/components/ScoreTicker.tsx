import { useEffect, useState } from 'react';
import { collection, db, onSnapshot, query } from '../lib/firebase';
import { Match } from '../types';

export default function ScoreTicker() {
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'matches'));
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const liveMatches: Match[] = [];
      snapshot.forEach((doc: any) => {
        liveMatches.push(doc.data());
      });
      setMatches(liveMatches.filter((m) => m.status === 'live'));
    });
    return () => unsubscribe();
  }, []);

  if (matches.length === 0) return null;

  return (
    <div className="bg-geo-header border-b border-geo-border text-white p-2 text-xs font-mono overflow-hidden">
      <div className="flex gap-8 whitespace-nowrap animate-pulse">
        {matches.map((m) => (
          <span key={m.id} className="font-bold">
            {m.homeTeam} <span className="text-geo-brand">{m.score.home}</span> - <span className="text-geo-brand">{m.score.away}</span> {m.awayTeam}
          </span>
        ))}
      </div>
    </div>
  );
}

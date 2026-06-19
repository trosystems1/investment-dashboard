import MajorShareholdersTable from '@/components/MajorShareholdersTable';
import { getAllShareholderRecords } from '@/lib/edinet-shareholders-store';

const WATCHLIST = [
  { secCode: '228A0', name: 'オプロ' },
  { secCode: '43970', name: 'チームスピリット' },
  { secCode: '43740', name: 'ROBOT PAYMENT' },
  { secCode: '431A0', name: 'uSonar' },
  { secCode: '44430', name: 'Sansan' },
  { secCode: '44780', name: 'freee' },
  { secCode: '39940', name: 'マネーフォワード' },
  { secCode: '47760', name: 'サイボウズ' },
  { secCode: '40580', name: 'トヨクモ' },
  { secCode: '48110', name: 'ドリーム・アーツ' },
];

export const dynamic = 'force-dynamic';

export default async function ShareholdersPage() {
  const secCodes = WATCHLIST.map((w) => w.secCode);
  const records = await getAllShareholderRecords(secCodes);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-lg font-semibold text-zinc-100">大株主モニター</h1>
      {WATCHLIST.map((w) => {
        const record = records[w.secCode];
        return (
          <MajorShareholdersTable
            key={w.secCode}
            companyName={w.name}
            asOfDate={record?.submitDateTime || ''}
            shareholders={record?.shareholders || []}
          />
        );
      })}
    </div>
  );
}

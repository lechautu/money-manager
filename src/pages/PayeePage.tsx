import { PayeeManager } from '../components/settings/PayeeManager';

export default function PayeePage() {
    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold mb-6">Payees</h1>
            <PayeeManager />
        </div>
    );
}

import { CategoryManager } from '../components/settings/CategoryManager';

export default function CategoryPage() {
    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold mb-6">Categories</h1>
            <CategoryManager />
        </div>
    );
}

interface ValidationRowProps {
  rowIndex: number;
  sku: string;
  errors: Array<{ field: string; code: string; message: string }>;
}

export default function ValidationRow({ rowIndex, sku, errors }: ValidationRowProps) {
  return (
    <tr className="bg-security-50">
      <td className="px-4 py-2.5 text-sm text-gray-600 whitespace-nowrap">
        {rowIndex}
      </td>
      <td className="px-4 py-2.5 text-sm font-medium text-security-900 whitespace-nowrap">
        {sku || 'N/A'}
      </td>
      <td className="px-4 py-2.5">
        <ul className="list-none space-y-0.5">
          {errors.map((error, idx) => (
            <li key={idx} className="text-xs text-security-700">
              {error.message}
            </li>
          ))}
        </ul>
      </td>
    </tr>
  );
}

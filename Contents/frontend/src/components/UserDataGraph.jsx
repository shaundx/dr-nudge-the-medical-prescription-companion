import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// Example: expects an array of { date, weight, height }
export default function UserDataGraph({ data }) {
  return (
    <div className="bg-white rounded-3xl p-5 mb-5 shadow-sm border border-gray-100">
      <h2 className="text-base font-bold text-gray-900 mb-2">Your Health Progress</h2>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name="Weight (kg)" />
          <Line type="monotone" dataKey="taken" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} name="Taken" />
          <Line type="monotone" dataKey="missed" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} name="Missed" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell } from 'recharts';
import { useAdminOverview } from '../../hooks/useAdminOverview';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-loft-900 border border-loft-800 p-3 rounded-xl shadow-xl">
        <p className="text-xs text-loft-400 font-medium">{payload[0].payload.date}</p>
        <p className="text-sm font-bold text-copper-500 mt-1">₹{payload[0].value.toLocaleString()}</p>
      </div>
    );
  }
  return null;
};

const CustomRouteTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const trips = payload[0].value;
    return (
      <div className="bg-loft-900 border border-loft-800 p-3 rounded-xl shadow-xl max-w-xs">
        <p className="text-xs text-loft-200 font-bold">{payload[0].payload.route}</p>
        <p className="text-sm font-semibold text-moss-500 mt-1">
          {trips} completed {trips === 1 ? 'trip' : 'trips'}
        </p>
      </div>
    );
  }
  return null;
};

const AnalyticsTab = () => {
  const { revenueData, routeData, fetchOverviewData } = useAdminOverview();

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-loft-50 font-serif">Business Analytics</h1>
        <button 
          onClick={fetchOverviewData}
          className="btn-secondary py-2 px-4 text-sm font-semibold rounded-xl cursor-pointer"
        >
          Refresh Reports
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <div className="card p-8 bg-loft-900 border-loft-800">
          <h3 className="text-xl font-bold text-loft-50 font-serif mb-2">Revenue Growth</h3>
          <p className="text-sm text-loft-400 mb-6">Detailed transaction analytics across standard billing dates.</p>
          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevFull" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e86331" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#e86331" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2220" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" stroke="#e86331" fillOpacity={1} fill="url(#colorRevFull)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-8 bg-loft-900 border-loft-800">
          <h3 className="text-xl font-bold text-loft-50 font-serif mb-2">Popular Route Traffic</h3>
          <p className="text-sm text-loft-400 mb-6">Visual volume representation of peak-loaded routes.</p>
          <div className="h-96 w-full">
            {routeData && routeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={routeData} layout="vertical" margin={{ top: 10, right: 20, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2c2420" horizontal={false} />
                  <XAxis type="number" stroke="#94a3b8" fontSize={12} allowDecimals={false} />
                  <YAxis dataKey="route" type="category" stroke="#94a3b8" fontSize={11} width={150} tickLine={false} />
                  <Tooltip content={<CustomRouteTooltip />} />
                  <Bar dataKey="trips" fill="#229e64" radius={[0, 6, 6, 0]} barSize={24}>
                    {routeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#e86331' : '#229e64'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-loft-500 py-12">
                <p className="text-sm font-medium">No completed route data available yet.</p>
                <p className="text-xs text-loft-600 mt-1">Completed trips will appear here automatically.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsTab;

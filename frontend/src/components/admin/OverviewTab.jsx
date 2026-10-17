import { motion } from 'framer-motion';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell } from 'recharts';
import { DollarSign, Truck, FileText, Users } from 'lucide-react';
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

const OverviewTab = () => {
  const { stats, revenueData, routeData } = useAdminOverview();

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-loft-50 font-serif">System Overview</h1>
        <div className="text-sm text-loft-400">Last updated: Just now</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Revenue (Today)', value: stats.revenue, icon: DollarSign, color: 'text-moss-500' },
          { label: 'Active Drivers', value: stats.activeDrivers, icon: Truck, color: 'text-blue-500' },
          { label: 'Total Vehicles', value: stats.totalVehicles, icon: FileText, color: 'text-copper-500' },
          { label: 'Total Customers', value: stats.totalCustomers, icon: Users, color: 'text-red-500' }
        ].map((stat, idx) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            key={idx} 
            className="card p-5 bg-loft-900 border-loft-800"
          >
            <div className="flex justify-between items-start mb-4">
              <p className="text-loft-400 text-xs font-medium uppercase tracking-wider">{stat.label}</p>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <p className="text-2xl font-bold text-loft-50">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6 bg-loft-900 border-loft-800 h-80 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-loft-50 font-serif">Revenue Trend</h3>
            <p className="text-xs text-loft-400">Weekly platform transactions</p>
          </div>
          <div className="h-56 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e86331" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#e86331" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2220" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" stroke="#e86331" fillOpacity={1} fill="url(#colorRev)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6 bg-loft-900 border-loft-800 h-80 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-loft-50 font-serif">Popular Routes</h3>
            <p className="text-xs text-loft-400">Top 5 trip destinations</p>
          </div>
          <div className="h-56 w-full mt-4">
            {routeData && routeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={routeData} layout="vertical" margin={{ top: 10, right: 10, left: 30, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2c2420" horizontal={false} />
                  <XAxis type="number" stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                  <YAxis dataKey="route" type="category" stroke="#94a3b8" fontSize={10} width={120} tickLine={false} />
                  <Tooltip content={<CustomRouteTooltip />} />
                  <Bar dataKey="trips" fill="#229e64" radius={[0, 4, 4, 0]}>
                    {routeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#e86331' : '#229e64'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-loft-500 py-6">
                <p className="text-xs text-loft-400">No completed route data yet</p>
                <p className="text-[11px] text-loft-600 mt-1">Completed trips will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="card bg-loft-900 border-loft-800 overflow-hidden">
        <div className="p-6 border-b border-loft-800 flex justify-between items-center">
          <h3 className="text-lg font-bold text-loft-50">Live Platform Activity</h3>
          <button className="text-copper-500 text-sm font-medium hover:text-copper-400">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-loft-300">
            <thead className="bg-loft-950/50 text-xs uppercase font-medium">
              <tr>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4">Event</th>
                <th className="px-6 py-4">User/Driver</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-loft-800">
              {stats.activities && stats.activities.length > 0 ? (
                stats.activities.map((row, idx) => (
                  <tr key={idx} className="hover:bg-loft-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">{row.time}</td>
                    <td className="px-6 py-4">{row.event}</td>
                    <td className="px-6 py-4 font-medium text-loft-200">{row.user}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        row.status === 'Success' || row.status === 'Completed' ? 'bg-moss-500/10 text-moss-500' :
                        row.status === 'Pending' ? 'bg-red-500/10 text-red-500' : 'bg-copper-500/10 text-copper-500'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-loft-500">
                    No recent live activity recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;

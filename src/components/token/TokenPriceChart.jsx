// src/components/token/TokenPriceChart.jsx
import React, { useState, useEffect } from 'react';
import { fetchCandlestickData } from '../../utils/pumpFunAPI';

const TokenPriceChart = ({ tokenAddress }) => {
  const [candlesticks, setCandlesticks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState(5); // 5-minute intervals by default
  const [error, setError] = useState(null);
  
  // Fetch candlestick data when component mounts or timeframe changes
  useEffect(() => {
    const loadCandlestickData = async () => {
      if (!tokenAddress) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const data = await fetchCandlestickData(tokenAddress, timeframe, 100);
        setCandlesticks(data);
      } catch (err) {
        console.error('Error loading candlestick data:', err);
        setError('Failed to load price chart data');
      } finally {
        setLoading(false);
      }
    };
    
    loadCandlestickData();
  }, [tokenAddress, timeframe]);
  
  // Calculate chart dimensions
  const chartWidth = 600;
  const chartHeight = 300;
  const padding = { top: 20, right: 30, bottom: 30, left: 50 };
  
  // If there's no data yet, show a loading state
  if (loading) {
    return (
      <div className="token-price-chart-loading">
        <div className="loading-spinner"></div>
        <p>Loading price chart...</p>
      </div>
    );
  }
  
  // If there's an error, show an error message
  if (error) {
    return (
      <div className="token-price-chart-error">
        <p>{error}</p>
      </div>
    );
  }
  
  // If there's no candlestick data, show a message
  if (!candlesticks || candlesticks.length === 0) {
    return (
      <div className="token-price-chart-empty">
        <p>No price data available for this token.</p>
      </div>
    );
  }
  
  // Find min and max values for y-axis (price)
  const prices = candlesticks.flatMap(candle => [candle.high, candle.low]);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  
  // Add some padding to the price range
  const yMin = Math.max(0, minPrice - priceRange * 0.1);
  const yMax = maxPrice + priceRange * 0.1;
  
  // Create a simple line chart from closing prices
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  
  // Scale x coordinates (time)
  const xScale = (index) => 
    padding.left + (index / (candlesticks.length - 1)) * plotWidth;
  
  // Scale y coordinates (price)
  const yScale = (price) => 
    chartHeight - padding.bottom - ((price - yMin) / (yMax - yMin)) * plotHeight;
  
  // Create path for the line chart
  const linePath = candlesticks.map((candle, index) => {
    const x = xScale(index);
    const y = yScale(candle.close);
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
  
  // Format the timeframe label
  const getTimeframeLabel = (minutes) => {
    if (minutes < 60) return `${minutes}m`;
    if (minutes === 60) return '1h';
    return `${minutes/60}h`;
  };
  
  // Time frame options
  const timeframeOptions = [5, 15, 60, 240, 1440]; // 5m, 15m, 1h, 4h, 1d
  
  return (
    <div className="token-price-chart">
      <div className="chart-header">
        <h3>Price Chart</h3>
        <div className="timeframe-selector">
          {timeframeOptions.map(option => (
            <button
              key={option}
              className={`timeframe-button ${timeframe === option ? 'active' : ''}`}
              onClick={() => setTimeframe(option)}
            >
              {getTimeframeLabel(option)}
            </button>
          ))}
        </div>
      </div>
      
      <svg width={chartWidth} height={chartHeight} className="price-chart">
        {/* Chart background */}
        <rect 
          x={padding.left} 
          y={padding.top} 
          width={plotWidth} 
          height={plotHeight} 
          fill="#f8f9fa" 
          stroke="#e9ecef"
        />
        
        {/* Price line */}
        <path
          d={linePath}
          fill="none"
          stroke="#3498db"
          strokeWidth="2"
        />
        
        {/* Price points */}
        {candlesticks.map((candle, index) => (
          <circle
            key={index}
            cx={xScale(index)}
            cy={yScale(candle.close)}
            r="3"
            fill="#3498db"
          />
        ))}
        
        {/* Y-axis */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={chartHeight - padding.bottom}
          stroke="#ced4da"
          strokeWidth="1"
        />
        
        {/* X-axis */}
        <line
          x1={padding.left}
          y1={chartHeight - padding.bottom}
          x2={chartWidth - padding.right}
          y2={chartHeight - padding.bottom}
          stroke="#ced4da"
          strokeWidth="1"
        />
        
        {/* Y-axis labels (prices) */}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const price = yMin + ratio * (yMax - yMin);
          return (
            <g key={ratio}>
              <line
                x1={padding.left - 5}
                y1={yScale(price)}
                x2={padding.left}
                y2={yScale(price)}
                stroke="#ced4da"
              />
              <text
                x={padding.left - 10}
                y={yScale(price)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="12"
                fill="#6c757d"
              >
                ${price.toFixed(price < 0.01 ? 6 : 4)}
              </text>
            </g>
          );
        })}
        
        {/* X-axis labels (time) - show only a few for clarity */}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const index = Math.floor(ratio * (candlesticks.length - 1));
          const candle = candlesticks[index];
          if (!candle) return null;
          
          const date = new Date(candle.time);
          const label = `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
          
          return (
            <g key={ratio}>
              <line
                x1={xScale(index)}
                y1={chartHeight - padding.bottom}
                x2={xScale(index)}
                y2={chartHeight - padding.bottom + 5}
                stroke="#ced4da"
              />
              <text
                x={xScale(index)}
                y={chartHeight - padding.bottom + 20}
                textAnchor="middle"
                fontSize="12"
                fill="#6c757d"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default TokenPriceChart;
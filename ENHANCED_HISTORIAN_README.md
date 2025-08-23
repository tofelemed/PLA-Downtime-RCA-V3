# Enhanced Historian System

## Overview

The Enhanced Historian System provides a comprehensive solution for multi-attribute time series data analysis and visualization. It extends the existing historian functionality to support selecting multiple attributes from the PI AF hierarchy, plotting their values in interactive charts, and displaying data in paginated tables with advanced filtering and sorting capabilities.

## Key Features

### 🎯 Multi-Attribute Selection
- **Hierarchical Navigation**: Browse through PI AF hierarchy (servers → databases → elements → attributes)
- **Multi-Selection**: Select up to 15 attributes simultaneously for analysis
- **Smart Categorization**: Automatic categorization of attributes (temperature, pressure, flow, level, power, quality, other)
- **Search & Filter**: Find attributes quickly with search functionality and category-based filtering
- **Visual Feedback**: Clear indication of selected attributes with count limits

### 📊 Advanced Charting
- **Multiple Chart Types**: Line, Area, Bar, and Composed charts
- **Stream Visibility Control**: Show/hide individual streams or all streams at once
- **Interactive Controls**: Toggle grid, legend, and Y-axis domain settings
- **Color Coding**: Distinct colors for each attribute stream
- **Export Capabilities**: Export chart data to CSV format

### 📋 Enhanced Data Table
- **Pagination**: Configurable page sizes (25, 50, 100, 200 rows per page)
- **Advanced Filtering**: Filter by stream names and search within data
- **Sorting**: Sort by timestamp, stream name, or values (ascending/descending)
- **Stream Selection**: Choose which streams to display in the table
- **Quality Indicators**: Visual representation of data quality (good, questionable, substituted)
- **Export Functionality**: Export filtered data to CSV

### 🔄 Query Management
- **Query History**: Track recent queries with ability to reuse them
- **Flexible Time Ranges**: Support for recorded, interpolated, summary, and plot modes
- **Parameter Configuration**: Advanced query options including boundary types and summary calculations
- **Real-time Status**: Loading indicators and progress feedback

## Architecture

### Components Structure

```
EnhancedHistorianPage/
├── MultiAttributeSelector/     # Attribute selection interface
├── HistorianQueryForm/         # Query parameter configuration
├── TimeSeriesChart/           # Interactive charting component
├── TimeSeriesTable/           # Paginated data table
└── Query History/             # Query management and reuse
```

### Data Flow

1. **Attribute Selection**: User navigates AF hierarchy and selects multiple attributes
2. **Query Configuration**: User sets time range, mode, and other parameters
3. **Data Retrieval**: System queries PI historian for selected attributes
4. **Data Processing**: Results are processed and formatted for display
5. **Visualization**: Data is presented in charts and tables with interactive controls

## Usage Guide

### 1. Accessing the Enhanced Historian

Navigate to **Connectivity → PI Integration → Historian (Time Series)** tab, or access the standalone page at **Enhanced Historian**.

### 2. Selecting Attributes

1. **Choose Server**: Select your PI asset server from the dropdown
2. **Select Database**: Choose the AF database containing your elements
3. **Browse Elements**: Navigate through the element hierarchy (click arrows to expand)
4. **Select Attributes**: Check the attributes you want to analyze (up to 15)
5. **Review Selection**: See summary of selected attributes with categories

### 3. Configuring Queries

1. **Time Range**: Set start and end times for your data query
2. **Query Mode**: Choose between recorded, interpolated, summary, or plot
3. **Advanced Options**: Configure boundary types, intervals, and summary calculations
4. **Execute Query**: Click "Run" to fetch data from PI historian

### 4. Analyzing Results

#### Results Tab
- **Summary Statistics**: Overview of streams, data points, and attributes
- **Data Table**: Paginated view with sorting, filtering, and search
- **Export Options**: Download data in CSV format

#### Charts Tab
- **Chart Type Selection**: Choose between line, area, bar, or composed charts
- **Stream Control**: Show/hide individual streams or toggle all
- **Display Options**: Configure grid, legend, and Y-axis settings
- **Data Export**: Export chart data for external analysis

#### History Tab
- **Query Tracking**: View recent queries with parameters and results
- **Quick Reuse**: Reuse previous queries with one click
- **Performance Metrics**: Track data retrieval performance

## Technical Implementation

### Dependencies

- **React 18+**: Modern React with hooks and functional components
- **TypeScript**: Full type safety and IntelliSense support
- **Recharts**: Professional charting library for data visualization
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Lucide React**: Modern icon library for UI elements

### Key Technologies

- **PI Web API**: Integration with Aveva PI historian system
- **IndexedDB**: Local storage for query history and configuration
- **Responsive Design**: Mobile-friendly interface with adaptive layouts
- **Real-time Updates**: Live status monitoring and connection health checks

### Performance Features

- **Lazy Loading**: Components load only when needed
- **Data Pagination**: Efficient handling of large datasets
- **Stream Filtering**: Reduce chart complexity by hiding unused streams
- **Query Caching**: Store and reuse query results for better performance

## Configuration

### PI Connection Settings

```typescript
interface PIConfig {
  server: string;        // PI Web API endpoint
  username: string;      // PI username
  password: string;      // PI password
  database: string;      // AF database name
  enabled: boolean;      // Enable/disable integration
  syncInterval: string;  // Data sync frequency
}
```

### Historian Query Parameters

```typescript
interface HistorianQuery {
  mode: 'recorded' | 'interpolated' | 'summary' | 'plot';
  startTimeUtc: string;
  endTimeUtc: string;
  interval?: string;           // For interpolated/summary modes
  intervals?: number;          // For plot mode
  includeBad?: boolean;        // Include bad quality data
  boundaryType?: string;       // Boundary handling
  summaryTypes?: string;       // Summary calculations
}
```

## Best Practices

### Attribute Selection
- **Limit Selection**: Keep attribute count under 10 for optimal performance
- **Group Related**: Select attributes from the same element or process area
- **Consider Categories**: Use category filtering to find relevant attributes quickly

### Query Optimization
- **Time Ranges**: Use appropriate time ranges to avoid excessive data retrieval
- **Query Modes**: Choose the right mode for your analysis needs
- **Intervals**: Set appropriate intervals for interpolated and summary queries

### Data Management
- **Regular Exports**: Export important data sets for external analysis
- **Query History**: Use query history to track and reuse successful queries
- **Performance Monitoring**: Monitor query execution times and data volumes

## Troubleshooting

### Common Issues

1. **No Attributes Found**
   - Verify PI connection is active
   - Check user permissions for AF database access
   - Ensure element has attributes (not just child elements)

2. **Query Timeouts**
   - Reduce time range or number of attributes
   - Check PI server performance and network connectivity
   - Use summary mode for large time ranges

3. **Chart Performance Issues**
   - Limit visible streams to essential ones
   - Reduce data point density with appropriate intervals
   - Use pagination in data tables for large datasets

### Performance Tips

- **Batch Queries**: Group related attributes in single queries
- **Cache Results**: Reuse query results when possible
- **Optimize Time Ranges**: Use smallest practical time windows
- **Stream Management**: Hide unused streams to improve chart performance

## Future Enhancements

### Planned Features
- **Real-time Streaming**: Live data updates and alerts
- **Advanced Analytics**: Statistical analysis and trend detection
- **Custom Dashboards**: Saveable chart configurations and layouts
- **Data Comparison**: Side-by-side analysis of different time periods
- **Export Formats**: Support for Excel, JSON, and other formats

### Integration Opportunities
- **RCA Integration**: Direct correlation with root cause analysis
- **Alert System**: Automated notifications based on data thresholds
- **Workflow Integration**: Connect with maintenance and operational systems
- **Mobile Support**: Responsive design for tablet and mobile devices

## Support and Maintenance

### System Requirements
- Modern web browser (Chrome 90+, Firefox 88+, Safari 14+)
- PI Web API access with appropriate permissions
- Network connectivity to PI historian systems

### Maintenance Tasks
- **Regular Updates**: Keep PI Web API and client libraries updated
- **Performance Monitoring**: Track query performance and system health
- **User Training**: Provide training on new features and best practices
- **Backup Configuration**: Export and backup historian configurations

---

For technical support or feature requests, please contact the development team or create an issue in the project repository.

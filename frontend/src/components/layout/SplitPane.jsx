import React from 'react';

export const SplitPane = ({
  primary,
  secondary,
  secondaryWidth = 'w-full lg:w-80 xl:w-96',
  className = '',
  reverse = false
}) => {
  return (
    <div className={`flex flex-col lg:flex-row gap-6 items-start ${className}`}>
      {reverse ? (
        <>
          <div className={`shrink-0 ${secondaryWidth} w-full`}>{secondary}</div>
          <div className="flex-1 min-w-0 w-full">{primary}</div>
        </>
      ) : (
        <>
          <div className="flex-1 min-w-0 w-full">{primary}</div>
          <div className={`shrink-0 ${secondaryWidth} w-full`}>{secondary}</div>
        </>
      )}
    </div>
  );
};

export default SplitPane;

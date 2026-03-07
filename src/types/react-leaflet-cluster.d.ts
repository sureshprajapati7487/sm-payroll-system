declare module 'react-leaflet-cluster' {
    import { FC, PropsWithChildren } from 'react';
    export interface MarkerClusterGroupProps {
        chunkedLoading?: boolean;
        maxClusterRadius?: number;
    }

    const MarkerClusterGroup: FC<PropsWithChildren<MarkerClusterGroupProps>>;
    export default MarkerClusterGroup;
}

import {NavigationProp as RNavigationProp} from '@react-navigation/native';
import {RootStackParamList, RootTabParamList} from './index';

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList, RootTabParamList {}
  }
}

export {};


import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./button.tsx";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card.tsx";

const meta = {
  title: "UI/Layout/Card",
  component: Card,
  render: args => (
    <Card {...args} className="max-w-sm">
      <CardHeader>
        <CardTitle>Weekly report</CardTitle>
        <CardDescription>Sent every Monday at 9:00.</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="text-sm">12 recipients, 3 dashboards.</CardContent>
      <CardFooter>
        <Button variant="outline" size="sm">
          Send now
        </Button>
      </CardFooter>
    </Card>
  ),
} satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
